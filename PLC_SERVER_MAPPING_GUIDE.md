# PLC - Server - App Mapping Guide

## 1. Muc tieu

App khong doc PLC truc tiep. App goi REST API tu server rieng.

Luong du lieu khuyen nghi:

```text
MFM384 -> RS485/Modbus RTU -> PLC S7-1200 -> Ethernet -> Server API -> App
```

## 2. Tag cong suat tu MFM384

| Thong so | PLC tag | Dia chi |
|---|---|---|
| Dien ap | V1N | MD200 |
| Dong dien | I1N | MD212 |
| Tong cong suat | Total kW | MD224 |
| Tong dien nang | Total kWh | MD228 |

## 3. API server chinh

```text
GET  /api/power/current
GET  /api/devices
POST /api/devices/<device_id>/turn-on
POST /api/devices/<device_id>/turn-off
POST /api/scenes/<scene>
POST /api/assistant/chat
```

## 4. App cau hinh the nao?

Vao tab Cai dat -> Server API rieng:

```text
Emulator: http://10.0.2.2:5001
Dien thoai that: http://<IP-LAPTOP>:5001
Domain/VPS: https://api-tenmiencuaban.com
```

## 5. Ghi chu van hanh

1. PLC doc MFM384 qua RS485.
2. PLC luu gia tri vao MD tag.
3. Server doc PLC bang `python-snap7`.
4. App chi doc/ghi qua server API.
5. Chat AI/Unsloth sau nay nam sau endpoint `/api/assistant/chat`.
