# Smart Home Server API

Server rieng lam trung tam dieu khien va giam sat trong do an.

## Workflow

```text
MFM384 -> RS485/Modbus RTU -> PLC S7-1200 CPU 1215C
PLC -> Ethernet -> Laptop/VPS chay Smart Home Server
App -> REST API/domain server rieng
```

## Chay local

```powershell
cd c:\Users\ADMIN\.gemini\antigravity\scratch\smart-home-app\backend\smart_home_server
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Mac dinh server chay:

```text
http://127.0.0.1:5001
```

App Android emulator dung:

```text
http://10.0.2.2:5001
```

Dien thoai that dung IP LAN cua laptop:

```text
http://<IP-LAPTOP>:5001
```

Khi deploy domain:

```text
https://api-tenmiencuaban.com
```

## Endpoint hien co

```text
GET  /health
GET  /api/power/current
GET  /api/devices
POST /api/devices/<device_id>/turn-on
POST /api/devices/<device_id>/turn-off
POST /api/scenes/<scene>
POST /api/assistant/chat
```

## Tag cong suat dang cau hinh

```text
V1N       -> MD200 -> voltage
I1N       -> MD212 -> current
Total kW  -> MD224 -> power_kw
Total kWh -> MD228 -> energy_kwh
```

Neu PLC IP that khac `192.168.0.1`, sua trong `config.json`:

```json
{
  "plc": {
    "host": "192.168.0.1",
    "rack": 0,
    "slot": 1
  }
}
```

## Chuyen sang PLC that

1. Trong TIA Portal bat PUT/GET:

```text
CPU Properties -> Protection & Security
-> Permit access with PUT/GET communication from remote partner
```

2. Doi mode trong `config.json`:

```json
{
  "mode": "plc-real"
}
```

3. Chay lai server.

## Ghi chu

- `mock` mode dung de app test khong can PLC.
- `plc-real` mode doc power tag va device status tag bang `python-snap7`.
- Lenh dieu khien ghi vao `commandTag`, PLC nen xu ly command tag roi cap nhat lai status tag.
- Endpoint `/api/assistant/chat` hien la rule fallback. Sau nay co the thay bang Unsloth/LLM de tra JSON intent.
