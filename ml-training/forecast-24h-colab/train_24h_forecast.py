from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Callable

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor
from ucimlrepo import fetch_ucirepo


DEFAULT_RANDOM_STATE = 42
FORECAST_HORIZON_HOURS = 24
TARGET_COLUMN = "power_kw"
DEFAULT_MAX_HISTORY_DAYS = 730


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a 24-hour ahead household load forecasting model.")
    parser.add_argument("--data-source", choices=["uci", "local_csv"], default="uci")
    parser.add_argument("--csv-path", type=str, default="", help="Path to local PLC CSV when using --data-source local_csv")
    parser.add_argument("--artifacts-dir", type=str, default="artifacts_24h")
    parser.add_argument("--timestamp-col", type=str, default="timestamp")
    parser.add_argument("--power-col", type=str, default="power_kw")
    parser.add_argument(
        "--max-history-days",
        type=int,
        default=DEFAULT_MAX_HISTORY_DAYS,
        help="Use only the latest N days before training. Default is optimized for Colab free.",
    )
    return parser.parse_args()


def load_uci_dataset() -> pd.DataFrame:
    dataset = fetch_ucirepo(id=235)
    df = dataset.data.features.copy()

    rename_map = {
        "Date": "date",
        "Time": "time",
        "Global_active_power": "power_kw",
        "Global_reactive_power": "reactive_power_kw",
        "Voltage": "voltage",
        "Global_intensity": "current_a",
        "Sub_metering_1": "sub_metering_1",
        "Sub_metering_2": "sub_metering_2",
        "Sub_metering_3": "sub_metering_3",
    }

    df = df.rename(columns=rename_map)
    df["timestamp"] = pd.to_datetime(
        df["date"].astype(str) + " " + df["time"].astype(str),
        dayfirst=True,
        errors="coerce",
    )
    df = df.drop(columns=["date", "time"])

    return normalize_numeric_columns(df)


def load_local_csv(csv_path: str, timestamp_col: str, power_col: str) -> pd.DataFrame:
    if not csv_path:
        raise ValueError("csv_path is required when data_source=local_csv")

    df = pd.read_csv(csv_path)
    df = df.rename(columns={timestamp_col: "timestamp", power_col: "power_kw"})

    if "timestamp" not in df.columns or "power_kw" not in df.columns:
        raise ValueError("Local CSV must contain timestamp and power columns.")

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return normalize_numeric_columns(df)


def normalize_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.replace("?", np.nan)

    numeric_candidates = [
        "power_kw",
        "reactive_power_kw",
        "voltage",
        "current_a",
        "sub_metering_1",
        "sub_metering_2",
        "sub_metering_3",
    ]

    for column in numeric_candidates:
        if column not in df.columns:
            df[column] = np.nan
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=["timestamp", "power_kw"]).sort_values("timestamp").reset_index(drop=True)
    return df


def trim_recent_history(df: pd.DataFrame, max_history_days: int | None) -> pd.DataFrame:
    if not max_history_days or max_history_days <= 0:
        return df

    latest_timestamp = df["timestamp"].max()
    min_timestamp = latest_timestamp - pd.Timedelta(days=max_history_days)
    trimmed = df[df["timestamp"] >= min_timestamp].reset_index(drop=True)
    return trimmed if not trimmed.empty else df


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
    for column in ["reactive_power_kw", "voltage", "current_a", "sub_metering_1", "sub_metering_2", "sub_metering_3"]:
        hourly[column] = hourly[column].interpolate(limit_direction="both").fillna(0.0)

    return hourly


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    df["day_of_year"] = df["timestamp"].dt.dayofyear
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_peak_evening"] = df["hour"].isin([18, 19, 20, 21]).astype(int)
    df["is_peak_midday"] = df["hour"].isin([11, 12, 13]).astype(int)
    df["is_night"] = df["hour"].isin([0, 1, 2, 3, 4, 5]).astype(int)

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    df["doy_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 365.25)
    return df


def add_lag_features(df: pd.DataFrame, target_col: str) -> pd.DataFrame:
    df = df.copy()

    lag_steps = [1, 2, 3, 6, 12, 24, 25, 48, 72, 96, 120, 144, 168, 336]
    for lag in lag_steps:
        df[f"{target_col}_lag_{lag}"] = df[target_col].shift(lag)

    rolling_windows = [3, 6, 12, 24, 48, 72, 168]
    shifted = df[target_col].shift(1)
    for window in rolling_windows:
        df[f"{target_col}_roll_mean_{window}"] = shifted.rolling(window).mean()
        df[f"{target_col}_roll_std_{window}"] = shifted.rolling(window).std()
        df[f"{target_col}_roll_min_{window}"] = shifted.rolling(window).min()
        df[f"{target_col}_roll_max_{window}"] = shifted.rolling(window).max()

    df[f"{target_col}_delta_1"] = df[target_col].shift(1) - df[target_col].shift(2)
    df[f"{target_col}_delta_24"] = df[target_col].shift(1) - df[target_col].shift(25)
    df[f"{target_col}_delta_168"] = df[target_col].shift(1) - df[target_col].shift(169)
    df[f"{target_col}_ratio_24"] = df[target_col].shift(1) / (df[target_col].shift(25) + 1e-6)
    df[f"{target_col}_ratio_168"] = df[target_col].shift(1) / (df[target_col].shift(169) + 1e-6)
    df[f"{target_col}_ewm_mean_24"] = shifted.ewm(span=24, adjust=False).mean()
    df[f"{target_col}_ewm_mean_72"] = shifted.ewm(span=72, adjust=False).mean()
    df[f"{target_col}_same_hour_yesterday"] = df[target_col].shift(24)
    df[f"{target_col}_same_hour_last_week"] = df[target_col].shift(168)
    df[f"{target_col}_same_hour_mean_7d"] = pd.concat(
        [df[target_col].shift(24 * day) for day in range(1, 8)],
        axis=1,
    ).mean(axis=1)

    for column in ["reactive_power_kw", "voltage", "current_a", "sub_metering_1", "sub_metering_2", "sub_metering_3"]:
        df[f"{column}_lag_1"] = df[column].shift(1)
        df[f"{column}_lag_24"] = df[column].shift(24)
        df[f"{column}_lag_168"] = df[column].shift(168)
        df[f"{column}_roll_mean_6"] = df[column].shift(1).rolling(6).mean()
        df[f"{column}_roll_mean_24"] = df[column].shift(1).rolling(24).mean()

    return df


def build_supervised_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series]:
    df = add_time_features(df)
    df = add_lag_features(df, TARGET_COLUMN)

    target_frame = pd.concat(
        {
            f"target_t_plus_{step}": df[TARGET_COLUMN].shift(-step)
            for step in range(1, FORECAST_HORIZON_HOURS + 1)
        },
        axis=1,
    )
    df = pd.concat([df, target_frame], axis=1)

    df = df.dropna().reset_index(drop=True)

    target_columns = [f"target_t_plus_{step}" for step in range(1, FORECAST_HORIZON_HOURS + 1)]
    feature_columns = [
        column for column in df.columns
        if column not in {"timestamp", *target_columns}
    ]

    X = df[feature_columns].copy()
    y = df[target_columns].copy()
    timestamps = df["timestamp"].copy()
    return X, y, timestamps


def chronological_split(X: pd.DataFrame, y: pd.DataFrame, timestamps: pd.Series):
    total_rows = len(X)
    train_end = int(total_rows * 0.70)
    val_end = int(total_rows * 0.85)

    return {
        "train": (X.iloc[:train_end], y.iloc[:train_end], timestamps.iloc[:train_end]),
        "val": (X.iloc[train_end:val_end], y.iloc[train_end:val_end], timestamps.iloc[train_end:val_end]),
        "test": (X.iloc[val_end:], y.iloc[val_end:], timestamps.iloc[val_end:]),
    }


def build_model_factory(model_name: str, n_estimators_override: int | None = None) -> Callable[[], object]:
    if model_name == "random_forest":
        return lambda: RandomForestRegressor(
            n_estimators=n_estimators_override or 50,  # Giảm từ 180 xuống 50
            max_depth=12,  # Giảm từ 22 xuống 12 để ép file nhỏ lại
            min_samples_leaf=1,
            max_features="sqrt",
            random_state=DEFAULT_RANDOM_STATE,
            n_jobs=-1,
        )

    if model_name == "xgboost":
        return lambda: XGBRegressor(
            n_estimators=n_estimators_override or 150,  # Giảm từ 420 xuống 150
            max_depth=5,  # Giảm từ 7 xuống 5
            learning_rate=0.035,
            min_child_weight=2,
            subsample=0.95,
            colsample_bytree=0.90,
            reg_alpha=0.03,
            reg_lambda=1.8,
            objective="reg:squarederror",
            random_state=DEFAULT_RANDOM_STATE,
            n_jobs=-1,
            tree_method="hist",
        )

    raise ValueError(f"Unsupported model name: {model_name}")


def fit_direct_models(
    model_name: str,
    X_train: pd.DataFrame,
    y_train: pd.DataFrame,
    X_val: pd.DataFrame | None = None,
    y_val: pd.DataFrame | None = None,
):
    factory = build_model_factory(model_name)
    models = []
    best_iterations: list[int | None] = []

    for step in range(FORECAST_HORIZON_HOURS):
        model = factory()
        target = np.log1p(y_train.iloc[:, step].to_numpy())
        if model_name == "xgboost" and X_val is not None and y_val is not None:
            val_target = np.log1p(y_val.iloc[:, step].to_numpy())
            model.set_params(early_stopping_rounds=30)
            model.fit(
                X_train,
                target,
                eval_set=[(X_val, val_target)],
                verbose=False,
            )
            booster = model.get_booster()
            best_iterations.append((booster.best_iteration + 1) if booster.best_iteration is not None else model.n_estimators)
        else:
            model.fit(X_train, target)
            best_iterations.append(getattr(model, "n_estimators", None))
        models.append(model)

    return {
        "name": model_name,
        "models": models,
        "target_transform": "log1p",
        "best_iterations": best_iterations,
    }


def predict_direct_models(model_bundle: dict, X: pd.DataFrame) -> np.ndarray:
    predictions = []
    for model in model_bundle["models"]:
        pred = model.predict(X)
        pred = np.expm1(pred) if model_bundle.get("target_transform") == "log1p" else pred
        predictions.append(np.clip(pred, a_min=0.0, a_max=None))
    return np.column_stack(predictions)


def safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    denominator = np.clip(np.abs(y_true), a_min=0.2, a_max=None)
    return float(np.mean(np.abs((y_true - y_pred) / denominator)) * 100.0)


def evaluate_model(model_bundle: dict, X: pd.DataFrame, y: pd.DataFrame) -> dict:
    predictions = predict_direct_models(model_bundle, X)
    y_true = y.to_numpy()

    metrics = {
        "mae": float(mean_absolute_error(y_true, predictions)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, predictions))),
        "mape": safe_mape(y_true, predictions),
        "horizon_mae": {},
        "horizon_rmse": {},
    }

    for step in [1, 6, 12, 24]:
        column_index = step - 1
        metrics["horizon_mae"][f"h_plus_{step}"] = float(
            mean_absolute_error(y_true[:, column_index], predictions[:, column_index])
        )
        metrics["horizon_rmse"][f"h_plus_{step}"] = float(
            np.sqrt(mean_squared_error(y_true[:, column_index], predictions[:, column_index]))
        )

    return metrics


def fit_and_compare_models(splits):
    X_train, y_train, _ = splits["train"]
    X_val, y_val, _ = splits["val"]
    X_test, y_test, _ = splits["test"]

    results = {}

    for model_name in ["random_forest", "xgboost"]:
        print(f"Training {model_name}...")
        model_bundle = fit_direct_models(model_name, X_train, y_train, X_val, y_val)

        val_metrics = evaluate_model(model_bundle, X_val, y_val)
        test_metrics = evaluate_model(model_bundle, X_test, y_test)

        results[model_name] = {
            "model_bundle": model_bundle,
            "val_metrics": val_metrics,
            "test_metrics": test_metrics,
        }

        print(f"{model_name} validation MAE: {val_metrics['mae']:.4f}")
        print(f"{model_name} test MAE: {test_metrics['mae']:.4f}")

    best_model_name = min(results.keys(), key=lambda name: results[name]["val_metrics"]["mae"])
    return best_model_name, results


def refit_best_model(best_model_name: str, splits):
    X_train, y_train, _ = splits["train"]
    X_val, y_val, _ = splits["val"]
    X_train_val = pd.concat([X_train, X_val], axis=0)
    y_train_val = pd.concat([y_train, y_val], axis=0)

    if best_model_name != "xgboost":
        return fit_direct_models(best_model_name, X_train_val, y_train_val)

    tuned_bundle = fit_direct_models(best_model_name, X_train, y_train, X_val, y_val)
    best_iterations = tuned_bundle["best_iterations"]
    models = []

    for step in range(FORECAST_HORIZON_HOURS):
        n_estimators = best_iterations[step] if best_iterations[step] else 260
        model = build_model_factory(best_model_name, n_estimators_override=n_estimators)()
        target = np.log1p(y_train_val.iloc[:, step].to_numpy())
        model.fit(X_train_val, target, verbose=False)
        models.append(model)

    return {
        "name": best_model_name,
        "models": models,
        "target_transform": "log1p",
        "best_iterations": best_iterations,
    }


def build_sample_forecast(model_bundle: dict, splits) -> dict:
    X_test, y_test, timestamps_test = splits["test"]
    base_timestamp = pd.to_datetime(timestamps_test.iloc[0])
    prediction = predict_direct_models(model_bundle, X_test.iloc[[0]])[0]
    actual = y_test.iloc[0].to_numpy()

    forecast_rows = []
    for step in range(1, FORECAST_HORIZON_HOURS + 1):
        forecast_rows.append(
            {
                "timestamp": str(base_timestamp + pd.Timedelta(hours=step)),
                "predicted_kw": float(prediction[step - 1]),
                "actual_kw": float(actual[step - 1]),
            }
        )

    return {
        "base_timestamp": str(base_timestamp),
        "horizon_hours": FORECAST_HORIZON_HOURS,
        "forecast": forecast_rows,
    }


def save_artifacts(
    artifacts_dir: Path,
    feature_columns: list[str],
    dataset_summary: dict,
    best_model_name: str,
    best_model_bundle: dict,
    all_results: dict,
    sample_forecast: dict,
):
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    best_payload = {
        "model_name": best_model_name,
        "feature_columns": feature_columns,
        "forecast_horizon_hours": FORECAST_HORIZON_HOURS,
        "target_transform": best_model_bundle.get("target_transform"),
        "models": best_model_bundle["models"],
    }
    joblib.dump(best_payload, artifacts_dir / "best_model.joblib")

    for model_name, payload in all_results.items():
        export_payload = {
            "model_name": model_name,
            "feature_columns": feature_columns,
            "forecast_horizon_hours": FORECAST_HORIZON_HOURS,
            "target_transform": payload["model_bundle"].get("target_transform"),
            "models": payload["model_bundle"]["models"],
        }
        joblib.dump(export_payload, artifacts_dir / f"{model_name}_model.joblib")

    with open(artifacts_dir / "feature_columns.json", "w", encoding="utf-8") as file:
        json.dump(feature_columns, file, indent=2, ensure_ascii=False)

    with open(artifacts_dir / "metrics.json", "w", encoding="utf-8") as file:
        json.dump(
            {
                "dataset_summary": dataset_summary,
                "best_model": best_model_name,
                "results": {
                    name: {
                        "validation": payload["val_metrics"],
                        "test": payload["test_metrics"],
                    }
                    for name, payload in all_results.items()
                },
            },
            file,
            indent=2,
            ensure_ascii=False,
        )

    with open(artifacts_dir / "sample_forecast.json", "w", encoding="utf-8") as file:
        json.dump(sample_forecast, file, indent=2, ensure_ascii=False)


def main():
    args = parse_args()
    artifacts_dir = Path(args.artifacts_dir)

    if args.data_source == "uci":
        raw_df = load_uci_dataset()
        dataset_name = "UCI Individual Household Electric Power Consumption"
    else:
        raw_df = load_local_csv(args.csv_path, args.timestamp_col, args.power_col)
        dataset_name = "Local PLC CSV"

    raw_df = trim_recent_history(raw_df, args.max_history_days)
    hourly_df = resample_to_hourly(raw_df)
    X, y, timestamps = build_supervised_dataset(hourly_df)
    splits = chronological_split(X, y, timestamps)

    best_model_name, results = fit_and_compare_models(splits)
    best_model_bundle = refit_best_model(best_model_name, splits)
    sample_forecast = build_sample_forecast(best_model_bundle, splits)

    dataset_summary = {
        "dataset_name": dataset_name,
        "raw_rows": int(len(raw_df)),
        "hourly_rows": int(len(hourly_df)),
        "supervised_rows": int(len(X)),
        "max_history_days": args.max_history_days,
    }

    save_artifacts(
        artifacts_dir=artifacts_dir,
        feature_columns=list(X.columns),
        dataset_summary=dataset_summary,
        best_model_name=best_model_name,
        best_model_bundle=best_model_bundle,
        all_results=results,
        sample_forecast=sample_forecast,
    )

    summary = {
        "dataset_name": dataset_name,
        "raw_rows": int(len(raw_df)),
        "hourly_rows": int(len(hourly_df)),
        "supervised_rows": int(len(X)),
        "max_history_days": args.max_history_days,
        "best_model": best_model_name,
        "validation_mae": results[best_model_name]["val_metrics"]["mae"],
        "test_mae": results[best_model_name]["test_metrics"]["mae"],
        "test_rmse": results[best_model_name]["test_metrics"]["rmse"],
        "test_mape": results[best_model_name]["test_metrics"]["mape"],
        "artifacts_dir": str(artifacts_dir.resolve()),
    }

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
