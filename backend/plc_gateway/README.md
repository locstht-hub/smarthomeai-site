# PLC Power API

Thu muc nay giu API doc cong suat truc tiep tu PLC S7-1200 cho giai doan test nhanh.
Server chinh moi nam o `backend/smart_home_server/`.

## Luong du lieu

```text
MFM384 -> RS485/Modbus RTU -> PLC S7-1200 -> Ethernet -> Laptop -> App
```

## Tag cong suat dang cau hinh

```text
V1N       -> MD200
I1N       -> MD212
Total kW  -> MD224
Total kWh -> MD228
```

## Chay API

```powershell
cd c:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\backend\plc_gateway
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python power_api.py
```

Endpoint:

```text
GET /health
GET /api/power/current
```

## Khuyen nghi

Dung `backend/smart_home_server` cho workflow chinh vi server do co them:

```text
/api/devices
/api/scenes/<scene>
/api/assistant/chat
```

