"""
LSTM / CNN-LSTM predictor for the Flask forecast API.

Loads a Keras model (.keras) + scalers (joblib) and provides
the same interface as the existing XGBoost predict pipeline,
so app.py can switch between models transparently.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


# These must match train_lstm_forecast.py
DEFAULT_LOOKBACK = 168
FORECAST_HORIZON_HOURS = 24

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


class LstmPredictor:
    """Wraps a Keras LSTM/CNN-LSTM model for inference."""

    def __init__(self, artifacts_dir: str | Path):
        self.artifacts_dir = Path(artifacts_dir)
        self._load_artifacts()

    def _load_artifacts(self) -> None:
        import tensorflow as tf

        meta_path = self.artifacts_dir / "lstm_meta.json"
        with open(meta_path, "r", encoding="utf-8") as f:
            self.meta: dict[str, Any] = json.load(f)

        self.lookback: int = self.meta.get("lookback_hours", DEFAULT_LOOKBACK)
        self.horizon: int = self.meta.get("forecast_horizon_hours", FORECAST_HORIZON_HOURS)
        self.feature_columns: list[str] = self.meta.get("feature_columns", SEQUENCE_COLUMNS)
        self.best_model_name: str = self.meta.get("best_model", "cnn_lstm")

        # Load scalers
        self.x_scaler = joblib.load(self.artifacts_dir / "x_scaler.joblib")
        self.y_scaler = joblib.load(self.artifacts_dir / "y_scaler.joblib")

        # Load the best Keras model
        model_path = self.artifacts_dir / "best_model.keras"
        self.model = tf.keras.models.load_model(model_path)

        # Load metrics
        metrics_path = self.artifacts_dir / "metrics_lstm.json"
        if metrics_path.exists():
            with open(metrics_path, "r", encoding="utf-8") as f:
                self.metrics: dict[str, Any] = json.load(f)
        else:
            self.metrics = {}

        # Load sample forecast (fallback when no history provided)
        sample_path = self.artifacts_dir / "sample_forecast_lstm.json"
        if sample_path.exists():
            with open(sample_path, "r", encoding="utf-8") as f:
                self.sample_forecast: dict[str, Any] = json.load(f)
        else:
            self.sample_forecast = {}

    # ─── time features (match training) ────────────────────────
    @staticmethod
    def _add_time_features(df: pd.DataFrame) -> pd.DataFrame:
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
        return df

    # ─── normalize incoming history ───────────────────────────
    def _prepare_history(self, history: list[dict[str, Any]]) -> pd.DataFrame:
        """Normalize + resample + add time features from raw history."""
        df = pd.DataFrame(history).copy()
        if "timestamp" not in df.columns:
            raise ValueError("Each history row must include 'timestamp'")

        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)

        numeric_cols = [
            "power_kw", "reactive_power_kw", "voltage",
            "current_a", "sub_metering_1", "sub_metering_2", "sub_metering_3",
        ]
        for col in numeric_cols:
            if col not in df.columns:
                df[col] = np.nan
            df[col] = pd.to_numeric(df[col], errors="coerce")

        if df["power_kw"].isna().all():
            raise ValueError("history must include power_kw values")

        df["power_kw"] = df["power_kw"].interpolate(limit_direction="both")
        for col in numeric_cols[1:]:
            df[col] = df[col].interpolate(limit_direction="both").fillna(0.0)

        # Resample to hourly
        hourly = (
            df.set_index("timestamp")
            .resample("1h")
            .agg({col: "mean" if col not in ["sub_metering_1", "sub_metering_2", "sub_metering_3"] else "sum" for col in numeric_cols})
            .reset_index()
        )
        hourly["power_kw"] = hourly["power_kw"].interpolate(limit_direction="both")
        for col in numeric_cols[1:]:
            hourly[col] = hourly[col].interpolate(limit_direction="both").fillna(0.0)

        # Add time features
        hourly = self._add_time_features(hourly)

        # Ensure columns
        for col in self.feature_columns:
            if col not in hourly.columns:
                hourly[col] = 0.0

        return hourly

    # ─── predict ──────────────────────────────────────────────
    def predict_from_history(self, history: list[dict[str, Any]]) -> tuple[np.ndarray, pd.Timestamp]:
        """
        Accept raw history rows, build the look-back window, scale, predict,
        and return (predictions_kw[24], base_timestamp).
        """
        hourly = self._prepare_history(history)

        if len(hourly) < self.lookback:
            raise ValueError(
                f"Need at least {self.lookback} hourly rows; received {len(hourly)}"
            )

        # Take the last `lookback` rows as the input window
        window = hourly.iloc[-self.lookback:]
        base_timestamp = pd.to_datetime(window["timestamp"].iloc[-1])

        feature_data = window[self.feature_columns].to_numpy(dtype=np.float32)
        # Scale: reshape to (lookback, n_features) → flatten → scale → reshape
        n_features = len(self.feature_columns)
        scaled = self.x_scaler.transform(feature_data.reshape(-1, n_features))
        X_input = scaled.reshape(1, self.lookback, n_features)

        # Predict
        y_pred_scaled = self.model.predict(X_input, verbose=0)
        y_pred = self.y_scaler.inverse_transform(y_pred_scaled)[0]
        y_pred = np.clip(y_pred, a_min=0.0, a_max=None)

        return y_pred, base_timestamp

    def predict_sample(self) -> list[dict[str, Any]]:
        """Return the pre-computed sample forecast (for when no history is provided)."""
        if not self.sample_forecast:
            return []

        return [
            {
                "time": row["timestamp"],
                "predictedKw": round(float(row["predicted_kw"]), 4),
                "confidence": self._confidence_for_step(i + 1),
                "source": "flask_lstm",
            }
            for i, row in enumerate(self.sample_forecast.get("forecast", []))
        ]

    def _confidence_for_step(self, step: int) -> float:
        """Estimate confidence based on test metrics per horizon."""
        test_metrics = self.metrics.get("results", {}).get(
            self.best_model_name, {}
        ).get("test", {})
        mae = test_metrics.get("horizon_mae", {}).get(f"h_plus_{step}", test_metrics.get("mae", 0.5))
        return round(max(0.35, min(0.95, 1.0 - (float(mae) / 3.0))), 3)

    def get_model_info(self) -> dict[str, Any]:
        """Return model metadata for the /forecast/model-info endpoint."""
        ds = self.metrics.get("dataset_summary", {})
        test_metrics = self.metrics.get("results", {}).get(self.best_model_name, {}).get("test", {})
        return {
            "name": f"{self.best_model_name} 24h Forecast",
            "model_type": "keras_lstm",
            "lookback_hours": self.lookback,
            "forecast_horizon_hours": self.horizon,
            "trainingSamples": ds.get("sequence_samples"),
            "datasetName": ds.get("dataset_name"),
            "testMae": test_metrics.get("mae"),
            "testRmse": test_metrics.get("rmse"),
            "testMape": test_metrics.get("mape"),
        }
