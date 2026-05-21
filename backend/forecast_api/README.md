# Forecast API

Backend Python nho de doc `best_model.joblib` va tra du bao 24 gio toi cho app.

## Files

- `app.py`: Flask API
- `requirements.txt`: Python dependencies

## Run

```powershell
cd c:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\backend\forecast_api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

API mac dinh chay o:

`http://127.0.0.1:5000`

Neu test tren Android emulator, app nen dung:

`http://10.0.2.2:5000`

## Neu chua cai duoc Python

Co the chay local backend nhe bang Node.js:

```powershell
cd c:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\backend\forecast_api
node server.js
```

Server Node nay doc artifact da train san va tra ve du lieu forecast de app test end-to-end.

## Endpoints

- `GET /health`
- `GET /forecast/model-info`
- `GET /forecast/sample`
- `POST /forecast/predictions`
- `POST /forecast/insights`
- `POST /forecast/anomalies`

## Prediction payload

```json
{
  "history": [
    {
      "timestamp": "2026-04-06T00:00:00",
      "power_kw": 1.42,
      "reactive_power_kw": 0.12,
      "voltage": 232.7,
      "current_a": 6.2,
      "sub_metering_1": 0.0,
      "sub_metering_2": 1.0,
      "sub_metering_3": 14.0
    }
  ]
}
```

Ghi chu:

- Can toi thieu `337` diem sau khi resample hourly.
- Neu chua co lich su that, app co the goi sample mode bang body:

```json
{
  "allow_sample": true
}
```
