# 24h Forecast Training for Google Colab

This folder contains a Colab-friendly training pipeline for the Smart Home project.

## Recommended dataset for V1

Use **UCI Individual Household Electric Power Consumption** first.

Why this dataset is the best fit for the current project:
- one household only
- 1-minute sampling rate
- almost 4 years of history
- includes total active power, reactive power, voltage, current, and 3 sub-metering signals
- easy to use as a clean V1 dataset for `next 24 hours` household load forecasting

Links you shared that are more useful later:
- OPSD Household Data: good for multi-household / richer device behavior later
- Pecan Street: very strong for advanced research later, but heavier access and complexity
- London Smart Meter: useful for population-level analysis, less ideal for your first single-household V1

---

## Pipeline 1: XGBoost + RandomForest (tabular)

### What it does

- downloads the UCI dataset through `ucimlrepo`
- cleans missing values
- by default uses only the most recent **540 days** to keep training practical on Colab free
- resamples minute data to **hourly**
- builds richer supervised features for **direct 24-step forecasting**
- trains **one model per forecast hour** instead of one shared multi-output wrapper
- applies `log1p` target transform during training for better stability on low/high load ranges
- trains:
  - `RandomForest` baseline
  - `XGBoost` main model
- compares metrics on validation and test splits
- exports: trained model, metrics JSON, sample forecast JSON, feature columns JSON

### Colab quick start (XGBoost)

```python
!pip install -r /content/forecast-24h-colab/requirements.txt
!python /content/forecast-24h-colab/train_24h_forecast.py \
  --data-source uci \
  --artifacts-dir /content/artifacts_24h
```

### Expected output files (XGBoost)

- `best_model.joblib`
- `random_forest_model.joblib`
- `xgboost_model.joblib`
- `metrics.json`
- `feature_columns.json`
- `sample_forecast.json`

---

## Pipeline 2: LSTM + CNN-LSTM (deep learning)

### What it does

- Reuses the same UCI / local-CSV data pipeline as pipeline 1
- Resamples to hourly, adds cyclical time features
- Builds **sliding-window sequences**: 168 hours (7 days) input → 24 hours output
- Uses **MinMaxScaler** normalization (separate for features and targets)
- Trains two models:
  - **LSTM**: 2 LSTM layers (64→32 units) + Dropout(0.2) + Dense(64) + Dense(24)
  - **CNN-LSTM**: Conv1D(64, k=7) + Conv1D(32, k=5) + MaxPool + Dropout + LSTM(64) + Dense(64) + Dense(24)
- Uses **EarlyStopping** + **ReduceLROnPlateau**
- Selects best model by validation MAE
- Exports: Keras model (`.keras`), scalers (`.joblib`), metrics JSON, sample forecast JSON

### Colab quick start (LSTM)

```python
!pip install -r /content/forecast-24h-colab/requirements.txt
!python /content/forecast-24h-colab/train_lstm_forecast.py \
  --data-source uci \
  --artifacts-dir /content/artifacts_lstm
```

Options:

```python
# Customize training
!python /content/forecast-24h-colab/train_lstm_forecast.py \
  --data-source uci \
  --max-history-days 730 \
  --lookback 168 \
  --epochs 100 \
  --batch-size 64 \
  --patience 15 \
  --artifacts-dir /content/artifacts_lstm

# Use PLC data
!python /content/forecast-24h-colab/train_lstm_forecast.py \
  --data-source local_csv \
  --csv-path /content/plc_house.csv \
  --artifacts-dir /content/artifacts_lstm_plc
```

### Expected output files (LSTM)

- `best_model.keras` — best Keras model (LSTM or CNN-LSTM)
- `lstm_model.keras` — pure LSTM model
- `cnn_lstm_model.keras` — CNN-LSTM hybrid model
- `x_scaler.joblib` — feature scaler
- `y_scaler.joblib` — target scaler
- `lstm_meta.json` — model metadata (lookback, features, best model name)
- `metrics_lstm.json` — metrics for both models
- `sample_forecast_lstm.json` — sample predictions
- `feature_columns_lstm.json` — feature column list

### How to deploy LSTM to Flask API

After training on Colab:

1. Download the `artifacts_lstm/` folder from Colab
2. Copy all files into `ml-training/modeltrainingdone/lstm/`
3. Start Flask API: `python backend/forecast_api/app.py`
4. The API auto-detects LSTM artifacts and loads them

Test:

```bash
# XGBoost (default)
curl http://localhost:5000/forecast/sample

# LSTM
curl "http://localhost:5000/forecast/sample?model=lstm"

# Compare all models
curl http://localhost:5000/forecast/model-compare
```

---

## Forecast target

- Input: household historical hourly features up to time `t`
- Output: predicted `Global Active Power (kW)` for:
  - `t+1h`, `t+2h`, ..., `t+24h`

## Folder contents

- `train_24h_forecast.py`: XGBoost + RandomForest training script
- `train_lstm_forecast.py`: LSTM + CNN-LSTM training script
- `requirements.txt`: packages for Colab (includes tensorflow)
- `plc_schema_example.csv`: example schema for your future PLC CSV

## How to use your own PLC data later

When you have real PLC data, you can replace the public dataset with your own CSV.

Required minimum columns:
- `timestamp`
- `power_kw`

Recommended extra columns:
- `reactive_power_kw`
- `voltage`
- `current_a`
- `sub_metering_1`
- `sub_metering_2`
- `sub_metering_3`

## Recommended training strategy

For your project, use this order:

1. Train XGBoost on UCI first to validate the full pipeline
2. Train LSTM + CNN-LSTM on the same UCI data
3. Compare all 4 models (RandomForest, XGBoost, LSTM, CNN-LSTM) via `/forecast/model-compare`
4. Keep the best model as default in production
5. Replace dataset with PLC CSV later
6. Retrain all models and export new artifacts

## Notes

- Both scripts use **chronological split** (70/15/15), not random shuffle
- The best model is selected by **validation MAE**
- XGBoost uses direct 1-model-per-hour strategy with `log1p` transform
- LSTM uses sliding-window sequences (168h→24h) with MinMaxScaler
- Default settings are tuned for **Colab free** (GPU recommended for LSTM)
- The app does **not need any changes** — `FlaskForecastProvider` calls the same endpoints regardless of which backend model is active
