# Smart Home AI

Smart Home AI là đồ án giám sát điện năng và điều khiển nhà thông minh dùng MFM384, PLC Siemens S7-1200 CPU 1215C, backend API, app Android và website giới thiệu.

## Thành phần

- `src/`: app React Native / Expo.
- `backend/smart_home_server/`: Flask API chính cho app, thiết bị và dữ liệu công suất.
- `backend/forecast_api/`: API dự báo phụ tải bằng model ML.
- `backend/plc_gateway/`: API/gateway thử nghiệm đọc PLC.
- `ml-training/`: script huấn luyện model và tài liệu ML.
- `project-site/`: website tĩnh giới thiệu đồ án, deploy được lên Cloudflare Pages.

## Domain

```text
https://smarthomeai.id.vn      -> website giới thiệu tĩnh
https://api.smarthomeai.id.vn  -> API backend qua Cloudflare Tunnel
```

## Chạy app

```powershell
npm install
npm start
```

Android:

```powershell
npm run android
```

## Chạy backend API local

```powershell
cd backend\smart_home_server
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

API local:

```text
http://127.0.0.1:5001/health
```

## Cloudflare Tunnel

Máy laptop có thể chạy backend local và public qua Cloudflare Tunnel:

```text
https://api.smarthomeai.id.vn -> http://localhost:5001
```

Script hỗ trợ trên máy local nằm ở:

```text
C:\tmp\smart-home-api-runner
```

Các script này không nằm trong repo vì chứa token/môi trường riêng của máy.

## Deploy website giới thiệu

Upload thư mục:

```text
project-site
```

lên Cloudflare Pages bằng Direct Upload hoặc Git integration.

## Ghi chú GitHub

Repo đã ignore các file nặng/tạm:

- `node_modules/`
- `.venv/`
- `android/`, `ios/`, build output
- log, APK/AAB
- model artifact như `.joblib`, `.keras`, `model_artifacts.zip`
- config runtime như `backend/**/config.json`

Nếu cần chia sẻ model ML, nên đưa qua GitHub Releases, Google Drive hoặc Hugging Face thay vì commit trực tiếp.
