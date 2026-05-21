from __future__ import annotations

import io
import json
import threading
import time
import zipfile
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request


BASE_DIR = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = BASE_DIR / "ml-training" / "modeltrainingdone"
MODEL_PATH = ARTIFACTS_DIR / "best_model.joblib"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"
SAMPLE_FORECAST_PATH = ARTIFACTS_DIR / "sample_forecast.json"
ZIP_PATH = ARTIFACTS_DIR / "model_artifacts.zip"
TARGET_COLUMN = "power_kw"
MAX_REQUIRED_LAG = 336
FORECAST_SOURCE = "flask_model"

# LSTM artifacts directory (created by train_lstm_forecast.py)
LSTM_ARTIFACTS_DIR = BASE_DIR / "ml-training" / "modeltrainingdone" / "lstm"
LSTM_AVAILABLE = False
LSTM_PREDICTOR = None

NUMERIC_COLUMNS = [
    "power_kw",
    "reactive_power_kw",
    "voltage",
    "current_a",
    "sub_metering_1",
    "sub_metering_2",
    "sub_metering_3",
]


def load_json_file(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def load_json_from_zip(entry_name: str) -> dict[str, Any]:
    with zipfile.ZipFile(ZIP_PATH, "r") as archive:
        with archive.open(entry_name) as file:
            return json.load(io.TextIOWrapper(file, encoding="utf-8"))


MODEL_BUNDLE = joblib.load(MODEL_PATH)
METRICS = load_json_file(METRICS_PATH)
SAMPLE_FORECAST = load_json_file(SAMPLE_FORECAST_PATH) if SAMPLE_FORECAST_PATH.exists() else load_json_from_zip("sample_forecast.json")
FEATURE_COLUMNS: list[str] = list(MODEL_BUNDLE["feature_columns"])
FORECAST_HORIZON_HOURS = int(MODEL_BUNDLE["forecast_horizon_hours"])
MODEL_NAME = str(MODEL_BUNDLE["model_name"])
BEST_TEST_METRICS = METRICS["results"][MODEL_NAME]["test"]

# Try to load LSTM predictor if artifacts exist
try:
    lstm_meta_path = LSTM_ARTIFACTS_DIR / "lstm_meta.json"
    if lstm_meta_path.exists():
        from lstm_predictor import LstmPredictor
        LSTM_PREDICTOR = LstmPredictor(LSTM_ARTIFACTS_DIR)
        LSTM_AVAILABLE = True
        print(f"[OK] LSTM model loaded: {LSTM_PREDICTOR.best_model_name}")
except Exception as e:
    print(f"[WARN] LSTM model not available: {e}")
    LSTM_AVAILABLE = False

app = Flask(__name__)


def normalize_history(history: list[dict[str, Any]]) -> pd.DataFrame:
    if not history:
        raise ValueError("history is required unless allow_sample=true")

    df = pd.DataFrame(history).copy()
    if "timestamp" not in df.columns:
        raise ValueError("Each history row must include timestamp")

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)

    for column in NUMERIC_COLUMNS:
        if column not in df.columns:
            df[column] = np.nan
        df[column] = pd.to_numeric(df[column], errors="coerce")

    if df[TARGET_COLUMN].isna().all():
        raise ValueError("history must include power_kw values")

    df[TARGET_COLUMN] = df[TARGET_COLUMN].interpolate(limit_direction="both")
    for column in NUMERIC_COLUMNS[1:]:
        df[column] = df[column].interpolate(limit_direction="both").fillna(0.0)

    return df


def resample_to_hourly(df: pd.DataFrame) -> pd.DataFrame:
    hourly = (
        df.set_index("timestamp")
        .resample("1h")
        .agg(
            {
                "power_kw": "mean",
                "reactive_power_kw": "mean",
                "voltage": "mean",
                "current_a": "mean",
                "sub_metering_1": "sum",
                "sub_metering_2": "sum",
                "sub_metering_3": "sum",
            }
        )
        .reset_index()
    )

    hourly["power_kw"] = hourly["power_kw"].interpolate(limit_direction="both")
    for column in NUMERIC_COLUMNS[1:]:
        hourly[column] = hourly[column].interpolate(limit_direction="both").fillna(0.0)

    return hourly


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame["hour"] = frame["timestamp"].dt.hour
    frame["day_of_week"] = frame["timestamp"].dt.dayofweek
    frame["month"] = frame["timestamp"].dt.month
    frame["day_of_year"] = frame["timestamp"].dt.dayofyear
    frame["is_weekend"] = (frame["day_of_week"] >= 5).astype(int)
    frame["is_peak_evening"] = frame["hour"].isin([18, 19, 20, 21]).astype(int)
    frame["is_peak_midday"] = frame["hour"].isin([11, 12, 13]).astype(int)
    frame["is_night"] = frame["hour"].isin([0, 1, 2, 3, 4, 5]).astype(int)
    frame["hour_sin"] = np.sin(2 * np.pi * frame["hour"] / 24)
    frame["hour_cos"] = np.cos(2 * np.pi * frame["hour"] / 24)
    frame["dow_sin"] = np.sin(2 * np.pi * frame["day_of_week"] / 7)
    frame["dow_cos"] = np.cos(2 * np.pi * frame["day_of_week"] / 7)
    frame["month_sin"] = np.sin(2 * np.pi * frame["month"] / 12)
    frame["month_cos"] = np.cos(2 * np.pi * frame["month"] / 12)
    frame["doy_sin"] = np.sin(2 * np.pi * frame["day_of_year"] / 365.25)
    frame["doy_cos"] = np.cos(2 * np.pi * frame["day_of_year"] / 365.25)
    return frame


def add_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    lag_steps = [1, 2, 3, 6, 12, 24, 25, 48, 72, 96, 120, 144, 168, 336]
    for lag in lag_steps:
        frame[f"{TARGET_COLUMN}_lag_{lag}"] = frame[TARGET_COLUMN].shift(lag)

    shifted = frame[TARGET_COLUMN].shift(1)
    for window in [3, 6, 12, 24, 48, 72, 168]:
        frame[f"{TARGET_COLUMN}_roll_mean_{window}"] = shifted.rolling(window).mean()
        frame[f"{TARGET_COLUMN}_roll_std_{window}"] = shifted.rolling(window).std()
        frame[f"{TARGET_COLUMN}_roll_min_{window}"] = shifted.rolling(window).min()
        frame[f"{TARGET_COLUMN}_roll_max_{window}"] = shifted.rolling(window).max()

    frame[f"{TARGET_COLUMN}_delta_1"] = frame[TARGET_COLUMN].shift(1) - frame[TARGET_COLUMN].shift(2)
    frame[f"{TARGET_COLUMN}_delta_24"] = frame[TARGET_COLUMN].shift(1) - frame[TARGET_COLUMN].shift(25)
    frame[f"{TARGET_COLUMN}_delta_168"] = frame[TARGET_COLUMN].shift(1) - frame[TARGET_COLUMN].shift(169)
    frame[f"{TARGET_COLUMN}_ratio_24"] = frame[TARGET_COLUMN].shift(1) / (frame[TARGET_COLUMN].shift(25) + 1e-6)
    frame[f"{TARGET_COLUMN}_ratio_168"] = frame[TARGET_COLUMN].shift(1) / (frame[TARGET_COLUMN].shift(169) + 1e-6)
    frame[f"{TARGET_COLUMN}_ewm_mean_24"] = shifted.ewm(span=24, adjust=False).mean()
    frame[f"{TARGET_COLUMN}_ewm_mean_72"] = shifted.ewm(span=72, adjust=False).mean()
    frame[f"{TARGET_COLUMN}_same_hour_yesterday"] = frame[TARGET_COLUMN].shift(24)
    frame[f"{TARGET_COLUMN}_same_hour_last_week"] = frame[TARGET_COLUMN].shift(168)
    frame[f"{TARGET_COLUMN}_same_hour_mean_7d"] = pd.concat(
        [frame[TARGET_COLUMN].shift(24 * day) for day in range(1, 8)],
        axis=1,
    ).mean(axis=1)

    for column in NUMERIC_COLUMNS[1:]:
        frame[f"{column}_lag_1"] = frame[column].shift(1)
        frame[f"{column}_lag_24"] = frame[column].shift(24)
        frame[f"{column}_lag_168"] = frame[column].shift(168)
        frame[f"{column}_roll_mean_6"] = frame[column].shift(1).rolling(6).mean()
        frame[f"{column}_roll_mean_24"] = frame[column].shift(1).rolling(24).mean()

    return frame


def build_feature_row(history: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.Timestamp]:
    normalized = normalize_history(history)
    hourly = resample_to_hourly(normalized)

    if len(hourly) <= MAX_REQUIRED_LAG:
        raise ValueError(
            f"Need at least {MAX_REQUIRED_LAG + 1} hourly rows after resampling; received {len(hourly)}"
        )

    featured = add_lag_features(add_time_features(hourly)).dropna().reset_index(drop=True)
    if featured.empty:
        raise ValueError("Not enough history to build a prediction row after feature engineering")

    last_row = featured.iloc[[-1]].copy()
    for column in FEATURE_COLUMNS:
        if column not in last_row.columns:
            last_row[column] = 0.0

    return last_row[FEATURE_COLUMNS], pd.to_datetime(last_row["timestamp"].iloc[0])


def predict_values(feature_row: pd.DataFrame) -> np.ndarray:
    predictions = []
    for model in MODEL_BUNDLE["models"]:
        pred = np.asarray(model.predict(feature_row), dtype=float)
        if MODEL_BUNDLE.get("target_transform") == "log1p":
            pred = np.expm1(pred)
        predictions.append(np.clip(pred, a_min=0.0, a_max=None))
    return np.column_stack(predictions)[0]


def confidence_for_horizon(step: int) -> float:
    mae = BEST_TEST_METRICS.get("horizon_mae", {}).get(f"h_plus_{step}", BEST_TEST_METRICS["mae"])
    return round(max(0.35, min(0.95, 1.0 - (float(mae) / 3.0))), 3)


def to_prediction_points(predictions: np.ndarray, base_timestamp: pd.Timestamp) -> list[dict[str, Any]]:
    rows = []
    for step, value in enumerate(predictions, start=1):
        rows.append(
            {
                "time": (base_timestamp + pd.Timedelta(hours=step)).isoformat(),
                "predictedKw": round(float(value), 4),
                "confidence": confidence_for_horizon(step),
                "source": FORECAST_SOURCE,
            }
        )
    return rows


def sample_prediction_points() -> list[dict[str, Any]]:
    return [
        {
            "time": row["timestamp"],
            "predictedKw": round(float(row["predicted_kw"]), 4),
            "confidence": confidence_for_horizon(index + 1),
            "source": FORECAST_SOURCE,
        }
        for index, row in enumerate(SAMPLE_FORECAST["forecast"])
    ]


def build_insights(prediction_points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    values = np.array([point["predictedKw"] for point in prediction_points], dtype=float)
    peak_index = int(values.argmax())
    avg_load = float(values.mean())
    max_load = float(values.max())
    trend = float(values[-6:].mean() - values[:6].mean())

    return [
        {
            "id": "peak-window",
            "title": "Khung gio cao nhat",
            "detail": f"Du bao dinh tai xuat hien quanh {prediction_points[peak_index]['time']}.",
            "value": f"{max_load:.2f} kW",
            "source": FORECAST_SOURCE,
        },
        {
            "id": "avg-next-24h",
            "title": "Trung binh 24 gio toi",
            "detail": "Gia tri trung binh cua toan bo cua so du bao 24 gio.",
            "value": f"{avg_load:.2f} kW",
            "source": FORECAST_SOURCE,
        },
        {
            "id": "trend-next-24h",
            "title": "Xu huong tai",
            "detail": "So sanh 6 gio dau va 6 gio cuoi cua cua so du bao.",
            "value": "Tang" if trend > 0.05 else "Giam" if trend < -0.05 else "On dinh",
            "source": FORECAST_SOURCE,
        },
    ]


def build_anomalies(prediction_points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    values = np.array([point["predictedKw"] for point in prediction_points], dtype=float)
    avg_load = float(values.mean())
    max_load = float(values.max())
    if max_load < avg_load * 1.35:
        return []

    peak_index = int(values.argmax())
    return [
        {
            "id": "forecast-peak-warning",
            "deviceName": "Tong tai he thong",
            "roomName": "Toan nha",
            "severity": "warning",
            "message": "Du bao xuat hien mot muc tai cao bat thuong trong 24 gio toi.",
            "detail": "Nen kiem tra dieu hoa, binh nong lanh hoac thiet bi cong suat lon trong khung gio nay.",
            "currentPower": round(max_load, 4),
            "normalPower": round(avg_load, 4),
            "detectedAt": prediction_points[peak_index]["time"],
            "source": FORECAST_SOURCE,
        }
    ]


def build_model_info() -> dict[str, Any]:
    dataset_summary = METRICS["dataset_summary"]
    return {
        "name": f"{MODEL_NAME} 24h Forecast",
        "lastUpdated": pd.Timestamp(MODEL_PATH.stat().st_mtime, unit="s").isoformat(),
        "trainingSamples": dataset_summary.get("supervised_rows"),
        "mode": "real_model",
        "datasetName": dataset_summary.get("dataset_name"),
        "testMae": BEST_TEST_METRICS.get("mae"),
        "testRmse": BEST_TEST_METRICS.get("rmse"),
        "testMape": BEST_TEST_METRICS.get("mape"),
    }


def payload_predictions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    history = payload.get("history") or []
    allow_sample = bool(payload.get("allow_sample"))
    if not history:
        if allow_sample:
            return sample_prediction_points()
        raise ValueError("history is required")

    feature_row, base_timestamp = build_feature_row(history)
    predictions = predict_values(feature_row)
    return to_prediction_points(predictions, base_timestamp)


# ═══════════════════════════════════════════════════════════════
# LSTM helper — build prediction points from LstmPredictor
# ═══════════════════════════════════════════════════════════════

def lstm_prediction_points(
    history: list[dict[str, Any]] | None,
    allow_sample: bool = False,
) -> list[dict[str, Any]]:
    """Run the LSTM predictor and return PredictionPoint-compatible dicts."""
    if LSTM_PREDICTOR is None:
        raise ValueError("LSTM model is not loaded")

    if not history:
        if allow_sample:
            return LSTM_PREDICTOR.predict_sample()
        raise ValueError("history is required")

    predictions, base_ts = LSTM_PREDICTOR.predict_from_history(history)
    rows = []
    for step, value in enumerate(predictions, start=1):
        rows.append({
            "time": (base_ts + pd.Timedelta(hours=step)).isoformat(),
            "predictedKw": round(float(value), 4),
            "confidence": LSTM_PREDICTOR._confidence_for_step(step),
            "source": "flask_lstm",
        })
    return rows


def get_requested_model() -> str:
    """Read ?model= query param. Default is 'xgboost'."""
    requested = request.args.get("model", "xgboost").strip().lower()
    if requested in {"lstm", "cnn_lstm", "cnn-lstm"}:
        return "lstm"
    return "xgboost"


def dispatch_predictions(payload: dict[str, Any], model_type: str) -> list[dict[str, Any]]:
    """Route to XGBoost or LSTM based on model_type."""
    if model_type == "lstm":
        if not LSTM_AVAILABLE:
            raise ValueError("LSTM model is not available. Train and deploy LSTM artifacts first.")
        history = payload.get("history") or []
        allow_sample = bool(payload.get("allow_sample"))
        return lstm_prediction_points(history or None, allow_sample)
    return payload_predictions(payload)


# ═══════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════

@app.get("/health")
def health_check():
    return jsonify(
        {
            "status": "ok",
            "model": MODEL_NAME,
            "lstm_available": LSTM_AVAILABLE,
            "lstm_model": LSTM_PREDICTOR.best_model_name if LSTM_AVAILABLE else None,
            "forecast_horizon_hours": FORECAST_HORIZON_HOURS,
            "artifacts_dir": str(ARTIFACTS_DIR),
        }
    )


@app.get("/forecast/model-info")
def model_info():
    model_type = get_requested_model()
    if model_type == "lstm" and LSTM_AVAILABLE:
        return jsonify(LSTM_PREDICTOR.get_model_info())
    return jsonify(build_model_info())


@app.get("/forecast/sample")
def sample_forecast():
    model_type = get_requested_model()
    if model_type == "lstm" and LSTM_AVAILABLE:
        predictions = LSTM_PREDICTOR.predict_sample()
    else:
        predictions = sample_prediction_points()
    return jsonify(
        {
            "predictions": predictions,
            "insights": build_insights(predictions),
            "anomalies": build_anomalies(predictions),
        }
    )


@app.post("/forecast/predictions")
def forecast_predictions():
    payload = request.get_json(silent=True) or {}
    model_type = get_requested_model()
    try:
        predictions = dispatch_predictions(payload, model_type)
        return jsonify({"predictions": predictions})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.post("/forecast/insights")
def forecast_insights():
    payload = request.get_json(silent=True) or {}
    model_type = get_requested_model()
    try:
        predictions = dispatch_predictions(payload, model_type)
        return jsonify({"insights": build_insights(predictions)})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.post("/forecast/anomalies")
def forecast_anomalies():
    payload = request.get_json(silent=True) or {}
    model_type = get_requested_model()
    try:
        predictions = dispatch_predictions(payload, model_type)
        return jsonify({"anomalies": build_anomalies(predictions)})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.get("/forecast/model-compare")
def model_compare():
    """Compare metrics of all available models side-by-side."""
    comparison: dict[str, Any] = {
        "xgboost": {
            "available": True,
            "model_name": MODEL_NAME,
            "test_metrics": BEST_TEST_METRICS,
            "model_info": build_model_info(),
        }
    }

    if LSTM_AVAILABLE and LSTM_PREDICTOR is not None:
        lstm_results = LSTM_PREDICTOR.metrics.get("results", {})
        for lstm_name, lstm_data in lstm_results.items():
            comparison[lstm_name] = {
                "available": True,
                "model_name": lstm_name,
                "test_metrics": lstm_data.get("test", {}),
                "model_info": LSTM_PREDICTOR.get_model_info(),
            }
    else:
        comparison["lstm"] = {"available": False}
        comparison["cnn_lstm"] = {"available": False}

    return jsonify(comparison)


@app.post("/forecast/trigger-retrain")
def trigger_retrain():
    """Proof of Concept endpoint for Edge Server Continuous Learning."""
    model_type = get_requested_model()

    def retrain_task(model: str):
        print("\n" + "=" * 60)
        print(f"[EDGE-ML] KÍCH HOẠT QUÁ TRÌNH TÁI HUẤN LUYỆN (RETRAIN) - {model.upper()}")
        print("=" * 60)
        print("[EDGE-ML] Dang ket noi toi database cuc bo cua server rieng...")
        time.sleep(2)
        print("[EDGE-ML] Lấy thành công dữ liệu điện năng tiêu thụ 30 ngày qua.")
        time.sleep(1)
        print("[EDGE-ML] Tiến hành làm sạch dữ liệu và tạo đặc trưng (Feature Engineering)...")
        time.sleep(2)
        print(f"[EDGE-ML] Khởi chạy thuật toán online-learning cho model {model.upper()}...")
        for i in range(1, 4):
            time.sleep(1.5)
            print(f"  > Epoch {i}/3 ... Loss đang giảm ...")
        time.sleep(1)
        print(f"[EDGE-ML] (GIẢ LẬP POC) Tích hợp trọng số (weights) mới vào kiến trúc.")
        print(f"[EDGE-ML] Lưu model vào Artifacts directory: {model.upper()}_v_updated.joblib")
        time.sleep(1)
        print("[EDGE-ML] KHỞI ĐỘNG LẠI PREDICTOR THÀNH CÔNG. EDGE DEVICE SẴN SÀNG!\n" + "=" * 60 + "\n")

    # Start the task in a background thread so the HTTP request returns immediately
    thread = threading.Thread(target=retrain_task, args=(model_type,))
    thread.daemon = True
    thread.start()

    return jsonify({"status": "accepted", "message": "Quá trình tái huấn luyện bắt đầu chạy ngầm tại Biên (Edge)."}), 202

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
