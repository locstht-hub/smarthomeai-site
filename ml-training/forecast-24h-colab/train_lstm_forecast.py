"""
LSTM & CNN-LSTM 24-hour load forecasting for Smart Home project.
Designed for Google Colab — reuses the same UCI / local-CSV data pipeline
as train_24h_forecast.py.

Usage (Colab):
    !pip install -r requirements.txt
    !python train_lstm_forecast.py --data-source uci --artifacts-dir /content/artifacts_lstm
"""

from __future__ import annotations

import argparse
import json
import os
import warnings
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import MinMaxScaler

# ----- reuse helpers from the existing XGBoost pipeline -----
from train_24h_forecast import (
    load_uci_dataset,
    load_local_csv,
    trim_recent_history,
    resample_to_hourly,
    add_time_features,
    safe_mape,
    TARGET_COLUMN,
    FORECAST_HORIZON_HOURS,
)

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
warnings.filterwarnings("ignore", category=FutureWarning)

DEFAULT_RANDOM_STATE = 42
LOOKBACK_HOURS = 168  # 7 days of hourly input → predict next 24 hours


# ═══════════════════════════════════════════════════════════════
# Feature columns for the sliding-window approach
# ═══════════════════════════════════════════════════════════════

SEQUENCE_COLUMNS = [
    "power_kw",
    "reactive_power_kw",
    "voltage",
    "current_a",
    "sub_metering_1",
    "sub_metering_2",
    "sub_metering_3",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "month_sin",
    "month_cos",
    "is_weekend",
    "is_peak_evening",
    "is_peak_midday",
    "is_night",
]


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train LSTM & CNN-LSTM 24h household load forecasting models.",
    )
    parser.add_argument("--data-source", choices=["uci", "local_csv"], default="uci")
    parser.add_argument("--csv-path", type=str, default="")
    parser.add_argument("--artifacts-dir", type=str, default="artifacts_lstm")
    parser.add_argument("--timestamp-col", type=str, default="timestamp")
    parser.add_argument("--power-col", type=str, default="power_kw")
    parser.add_argument(
        "--max-history-days",
        type=int,
        default=540,
        help="Use only the latest N days. Reduced default for Colab free GPU.",
    )
    parser.add_argument("--lookback", type=int, default=LOOKBACK_HOURS)
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--patience", type=int, default=12)
    return parser.parse_args()


# ═══════════════════════════════════════════════════════════════
# Sliding-window dataset builder
# ═══════════════════════════════════════════════════════════════

def build_sequences(
    df: pd.DataFrame,
    lookback: int,
    horizon: int,
    feature_columns: list[str],
    target_column: str,
) -> tuple[np.ndarray, np.ndarray, pd.DatetimeIndex]:
    """
    Build 3D input (samples, lookback, features) and 2D target (samples, horizon)
    from a sorted hourly DataFrame.
    """
    feature_data = df[feature_columns].to_numpy(dtype=np.float32)
    target_data = df[target_column].to_numpy(dtype=np.float32)
    timestamps = df["timestamp"].values

    X_list: list[np.ndarray] = []
    y_list: list[np.ndarray] = []
    ts_list: list[Any] = []

    total = len(df) - lookback - horizon + 1
    for i in range(total):
        X_list.append(feature_data[i : i + lookback])
        y_list.append(target_data[i + lookback : i + lookback + horizon])
        ts_list.append(timestamps[i + lookback - 1])

    return np.array(X_list), np.array(y_list), pd.DatetimeIndex(ts_list)


def chronological_split_seq(
    X: np.ndarray, y: np.ndarray, timestamps: pd.DatetimeIndex
) -> dict[str, tuple[np.ndarray, np.ndarray, pd.DatetimeIndex]]:
    n = len(X)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    return {
        "train": (X[:train_end], y[:train_end], timestamps[:train_end]),
        "val": (X[train_end:val_end], y[train_end:val_end], timestamps[train_end:val_end]),
        "test": (X[val_end:], y[val_end:], timestamps[val_end:]),
    }


# ═══════════════════════════════════════════════════════════════
# Scaling
# ═══════════════════════════════════════════════════════════════

def fit_scaler(
    X_train: np.ndarray, y_train: np.ndarray
) -> tuple[MinMaxScaler, MinMaxScaler]:
    """Fit separate scalers for features (3D→2D) and targets (2D)."""
    n_samples, lookback, n_features = X_train.shape
    x_scaler = MinMaxScaler()
    x_scaler.fit(X_train.reshape(-1, n_features))

    y_scaler = MinMaxScaler()
    y_scaler.fit(y_train)

    return x_scaler, y_scaler


def scale_X(X: np.ndarray, scaler: MinMaxScaler) -> np.ndarray:
    n_samples, lookback, n_features = X.shape
    flat = X.reshape(-1, n_features)
    scaled = scaler.transform(flat)
    return scaled.reshape(n_samples, lookback, n_features)


def scale_y(y: np.ndarray, scaler: MinMaxScaler) -> np.ndarray:
    return scaler.transform(y)


def inverse_scale_y(y_scaled: np.ndarray, scaler: MinMaxScaler) -> np.ndarray:
    return scaler.inverse_transform(y_scaled)


# ═══════════════════════════════════════════════════════════════
# Model builders
# ═══════════════════════════════════════════════════════════════

def build_lstm_model(lookback: int, n_features: int, horizon: int):
    """Pure LSTM: 2 layers → Dense."""
    import tensorflow as tf
    tf.random.set_seed(DEFAULT_RANDOM_STATE)

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(lookback, n_features)),
        tf.keras.layers.LSTM(64, return_sequences=True),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.LSTM(32, return_sequences=False),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dense(horizon),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="mse",
        metrics=["mae"],
    )
    return model


def build_cnn_lstm_model(lookback: int, n_features: int, horizon: int):
    """CNN-LSTM hybrid: Conv1D → MaxPool → LSTM → Dense."""
    import tensorflow as tf
    tf.random.set_seed(DEFAULT_RANDOM_STATE)

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(lookback, n_features)),
        # CNN block — extract local patterns
        tf.keras.layers.Conv1D(filters=64, kernel_size=7, activation="relu", padding="same"),
        tf.keras.layers.Conv1D(filters=32, kernel_size=5, activation="relu", padding="same"),
        tf.keras.layers.MaxPooling1D(pool_size=2),
        tf.keras.layers.Dropout(0.2),
        # LSTM block — capture temporal dependencies
        tf.keras.layers.LSTM(64, return_sequences=False),
        tf.keras.layers.Dropout(0.2),
        # Output
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dense(horizon),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="mse",
        metrics=["mae"],
    )
    return model


# ═══════════════════════════════════════════════════════════════
# Training
# ═══════════════════════════════════════════════════════════════

def train_model(
    model,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    epochs: int = 80,
    batch_size: int = 64,
    patience: int = 12,
    model_name: str = "model",
):
    """Train a Keras model with early stopping + LR reduction."""
    import tensorflow as tf

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=patience,
            restore_best_weights=True,
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=max(3, patience // 3),
            min_lr=1e-6,
            verbose=1,
        ),
    ]

    print(f"\n{'='*60}")
    print(f"Training {model_name}...")
    print(f"  X_train: {X_train.shape}, y_train: {y_train.shape}")
    print(f"  X_val:   {X_val.shape},   y_val:   {y_val.shape}")
    print(f"  epochs={epochs}, batch_size={batch_size}, patience={patience}")
    print(f"{'='*60}\n")

    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    return history


# ═══════════════════════════════════════════════════════════════
# Evaluation
# ═══════════════════════════════════════════════════════════════

def evaluate_keras_model(
    model,
    X: np.ndarray,
    y_scaled: np.ndarray,
    y_scaler: MinMaxScaler,
) -> tuple[dict, np.ndarray]:
    """Predict, inverse-scale, and compute MAE/RMSE/MAPE."""
    y_pred_scaled = model.predict(X, verbose=0)
    y_pred = inverse_scale_y(y_pred_scaled, y_scaler)
    y_true = inverse_scale_y(y_scaled, y_scaler)

    y_pred = np.clip(y_pred, a_min=0.0, a_max=None)

    metrics: dict[str, Any] = {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": safe_mape(y_true, y_pred),
        "horizon_mae": {},
        "horizon_rmse": {},
    }

    for step in [1, 6, 12, 24]:
        col = step - 1
        if col < y_pred.shape[1]:
            metrics["horizon_mae"][f"h_plus_{step}"] = float(
                mean_absolute_error(y_true[:, col], y_pred[:, col])
            )
            metrics["horizon_rmse"][f"h_plus_{step}"] = float(
                np.sqrt(mean_squared_error(y_true[:, col], y_pred[:, col]))
            )

    return metrics, y_pred


# ═══════════════════════════════════════════════════════════════
# Artifacts
# ═══════════════════════════════════════════════════════════════

def save_artifacts(
    artifacts_dir: Path,
    dataset_summary: dict,
    best_model_name: str,
    all_results: dict[str, dict],
    x_scaler: MinMaxScaler,
    y_scaler: MinMaxScaler,
    sample_forecast: dict,
    feature_columns: list[str],
    lookback: int,
):
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    # Save scalers
    joblib.dump(x_scaler, artifacts_dir / "x_scaler.joblib")
    joblib.dump(y_scaler, artifacts_dir / "y_scaler.joblib")

    # Save each Keras model
    for name, result in all_results.items():
        model_path = artifacts_dir / f"{name}_model.keras"
        result["model"].save(model_path)
        print(f"Saved {model_path}")

    # Copy best model
    import shutil
    best_src = artifacts_dir / f"{best_model_name}_model.keras"
    best_dst = artifacts_dir / "best_model.keras"
    shutil.copy2(best_src, best_dst)

    # Save metadata
    meta = {
        "model_type": "keras_lstm",
        "best_model": best_model_name,
        "lookback_hours": lookback,
        "forecast_horizon_hours": FORECAST_HORIZON_HOURS,
        "feature_columns": feature_columns,
    }
    with open(artifacts_dir / "lstm_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    # Save metrics
    metrics_payload = {
        "dataset_summary": dataset_summary,
        "best_model": best_model_name,
        "results": {
            name: {
                "validation": result["val_metrics"],
                "test": result["test_metrics"],
            }
            for name, result in all_results.items()
        },
    }
    with open(artifacts_dir / "metrics_lstm.json", "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2, ensure_ascii=False)

    # Save sample forecast
    with open(artifacts_dir / "sample_forecast_lstm.json", "w", encoding="utf-8") as f:
        json.dump(sample_forecast, f, indent=2, ensure_ascii=False)

    # Save feature columns
    with open(artifacts_dir / "feature_columns_lstm.json", "w", encoding="utf-8") as f:
        json.dump(feature_columns, f, indent=2, ensure_ascii=False)


def build_sample_forecast(
    model,
    X_test: np.ndarray,
    y_test_scaled: np.ndarray,
    y_scaler: MinMaxScaler,
    timestamps_test: pd.DatetimeIndex,
) -> dict:
    """Build a sample forecast from the first test window."""
    y_pred_scaled = model.predict(X_test[:1], verbose=0)
    y_pred = inverse_scale_y(y_pred_scaled, y_scaler)[0]
    y_true = inverse_scale_y(y_test_scaled[:1], y_scaler)[0]

    base_ts = pd.to_datetime(timestamps_test[0])
    rows = []
    for step in range(1, FORECAST_HORIZON_HOURS + 1):
        rows.append({
            "timestamp": str(base_ts + pd.Timedelta(hours=step)),
            "predicted_kw": round(float(np.clip(y_pred[step - 1], 0, None)), 4),
            "actual_kw": round(float(y_true[step - 1]), 4),
        })

    return {
        "base_timestamp": str(base_ts),
        "horizon_hours": FORECAST_HORIZON_HOURS,
        "forecast": rows,
    }


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

def main():
    args = parse_args()
    artifacts_dir = Path(args.artifacts_dir)
    lookback = args.lookback

    # --- Load & preprocess (reuse XGBoost pipeline) ---
    print("Loading data...")
    if args.data_source == "uci":
        raw_df = load_uci_dataset()
        dataset_name = "UCI Individual Household Electric Power Consumption"
    else:
        raw_df = load_local_csv(args.csv_path, args.timestamp_col, args.power_col)
        dataset_name = "Local PLC CSV"

    raw_df = trim_recent_history(raw_df, args.max_history_days)
    hourly_df = resample_to_hourly(raw_df)
    hourly_df = add_time_features(hourly_df)

    # Ensure all sequence columns exist
    for col in SEQUENCE_COLUMNS:
        if col not in hourly_df.columns:
            hourly_df[col] = 0.0

    print(f"Hourly rows: {len(hourly_df)}")

    # --- Build sliding-window sequences ---
    X, y, timestamps = build_sequences(
        hourly_df,
        lookback=lookback,
        horizon=FORECAST_HORIZON_HOURS,
        feature_columns=SEQUENCE_COLUMNS,
        target_column=TARGET_COLUMN,
    )
    print(f"Sequences: X={X.shape}, y={y.shape}")

    splits = chronological_split_seq(X, y, timestamps)

    X_train, y_train, ts_train = splits["train"]
    X_val, y_val, ts_val = splits["val"]
    X_test, y_test, ts_test = splits["test"]

    # --- Scale ---
    x_scaler, y_scaler = fit_scaler(X_train, y_train)

    X_train_s = scale_X(X_train, x_scaler)
    X_val_s = scale_X(X_val, x_scaler)
    X_test_s = scale_X(X_test, x_scaler)

    y_train_s = scale_y(y_train, y_scaler)
    y_val_s = scale_y(y_val, y_scaler)
    y_test_s = scale_y(y_test, y_scaler)

    n_features = X_train_s.shape[2]

    # --- Train both models ---
    model_configs = {
        "lstm": build_lstm_model(lookback, n_features, FORECAST_HORIZON_HOURS),
        "cnn_lstm": build_cnn_lstm_model(lookback, n_features, FORECAST_HORIZON_HOURS),
    }

    all_results: dict[str, dict] = {}

    for name, model in model_configs.items():
        model.summary()

        train_model(
            model,
            X_train_s, y_train_s,
            X_val_s, y_val_s,
            epochs=args.epochs,
            batch_size=args.batch_size,
            patience=args.patience,
            model_name=name,
        )

        val_metrics, _ = evaluate_keras_model(model, X_val_s, y_val_s, y_scaler)
        test_metrics, _ = evaluate_keras_model(model, X_test_s, y_test_s, y_scaler)

        print(f"\n{name} — Validation MAE: {val_metrics['mae']:.4f} kW")
        print(f"{name} — Test MAE:       {test_metrics['mae']:.4f} kW")
        print(f"{name} — Test RMSE:      {test_metrics['rmse']:.4f} kW")
        print(f"{name} — Test MAPE:      {test_metrics['mape']:.2f}%")

        all_results[name] = {
            "model": model,
            "val_metrics": val_metrics,
            "test_metrics": test_metrics,
        }

    # --- Pick best model ---
    best_model_name = min(all_results, key=lambda n: all_results[n]["val_metrics"]["mae"])
    best_model = all_results[best_model_name]["model"]
    print(f"\n{'='*60}")
    print(f"Best model: {best_model_name}")
    print(f"{'='*60}")

    # --- Sample forecast ---
    sample_forecast = build_sample_forecast(
        best_model, X_test_s, y_test_s, y_scaler, ts_test,
    )

    # --- Save ---
    dataset_summary = {
        "dataset_name": dataset_name,
        "raw_rows": int(len(raw_df)),
        "hourly_rows": int(len(hourly_df)),
        "sequence_samples": int(len(X)),
        "lookback_hours": lookback,
        "max_history_days": args.max_history_days,
    }

    save_artifacts(
        artifacts_dir=artifacts_dir,
        dataset_summary=dataset_summary,
        best_model_name=best_model_name,
        all_results=all_results,
        x_scaler=x_scaler,
        y_scaler=y_scaler,
        sample_forecast=sample_forecast,
        feature_columns=SEQUENCE_COLUMNS,
        lookback=lookback,
    )

    # --- Final summary ---
    summary = {
        "dataset_name": dataset_name,
        "raw_rows": int(len(raw_df)),
        "hourly_rows": int(len(hourly_df)),
        "sequence_samples": int(len(X)),
        "lookback_hours": lookback,
        "best_model": best_model_name,
        "validation_mae": all_results[best_model_name]["val_metrics"]["mae"],
        "test_mae": all_results[best_model_name]["test_metrics"]["mae"],
        "test_rmse": all_results[best_model_name]["test_metrics"]["rmse"],
        "test_mape": all_results[best_model_name]["test_metrics"]["mape"],
        "artifacts_dir": str(artifacts_dir.resolve()),
    }

    print("\n" + json.dumps(summary, indent=2, ensure_ascii=False))
    print("\nDone! Artifacts saved to:", artifacts_dir.resolve())


if __name__ == "__main__":
    main()
