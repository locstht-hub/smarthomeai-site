# Huong dan su dung Smart Home App

## 1. Kien truc moi

```text
MFM384 -> RS485/Modbus RTU -> PLC S7-1200 CPU 1215C
PLC -> Ethernet -> Smart Home Server API
App -> REST API / domain server rieng
```

App khong doc PLC truc tiep. App chi goi server rieng.

## 2. Tai khoan mau

Admin:

```text
So dien thoai: 0123456789
Mat khau: admin123
```

User demo:

```text
So dien thoai: 0987654321
Mat khau: user123
```

## 3. Chay server rieng

```powershell
cd c:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\backend\smart_home_server
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Server mac dinh:

```text
http://127.0.0.1:5001
```

## 4. Cau hinh app

Vao tab Cai dat -> Server API rieng:

```text
Android emulator: http://10.0.2.2:5001
Dien thoai that: http://<IP-LAPTOP>:5001
Domain/VPS: https://api-tenmiencuaban.com
```

Forecast API neu chay rieng:

```text
Android emulator: http://10.0.2.2:5000
Dien thoai that: http://<IP-LAPTOP>:5000
```

## 5. API dang dung

```text
GET  /health
GET  /api/power/current
GET  /api/devices
POST /api/devices/<device_id>/turn-on
POST /api/devices/<device_id>/turn-off
POST /api/scenes/<scene>
POST /api/assistant/chat
```

## 6. PLC tag cong suat

```text
V1N       -> MD200
I1N       -> MD212
Total kW  -> MD224
Total kWh -> MD228
```

Trong TIA Portal can bat PUT/GET:

```text
CPU Properties -> Protection & Security
-> Permit access with PUT/GET communication from remote partner
```

## 7. Build APK

```powershell
cd c:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:NODE_ENV = "production"
cd android
.\gradlew.bat assembleRelease --no-daemon --console=plain
```
