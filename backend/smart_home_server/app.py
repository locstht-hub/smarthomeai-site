from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request
from assistant_intents import parse_intent

try:
    import snap7
    from snap7.util import get_bool, get_dword, get_real, set_bool
except Exception:  # pragma: no cover
    snap7 = None  # type: ignore
    get_bool = None  # type: ignore
    get_dword = None  # type: ignore
    get_real = None  # type: ignore
    set_bool = None  # type: ignore


BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
STATE_PATH = BASE_DIR / "device_state.json"


def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def group_devices(devices: list[dict[str, Any]], states: dict[str, bool]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {
        "living": [],
        "bedroom": [],
        "kitchen": [],
        "garage": [],
    }

    for item in devices:
        room_id = str(item["roomId"])
        grouped.setdefault(room_id, []).append(
            {
                "id": item["id"],
                "name": item["name"],
                "type": item["type"],
                "isOn": bool(states.get(item["id"], False)),
                "power": item["power"],
                "roomId": room_id,
                "source": "server",
                "available": True,
            }
        )

    return grouped


class StateStore:
    def __init__(self, devices: list[dict[str, Any]]) -> None:
        self.devices = devices

    def load(self) -> dict[str, bool]:
        if STATE_PATH.exists():
            with STATE_PATH.open("r", encoding="utf-8") as f:
                raw = json.load(f)
            return {str(k): bool(v) for k, v in raw.items()}

        initial = {str(item["id"]): False for item in self.devices}
        self.save(initial)
        return initial

    def save(self, states: dict[str, bool]) -> None:
        with STATE_PATH.open("w", encoding="utf-8") as f:
            json.dump(states, f, indent=2)

    def set_state(self, device_id: str, is_on: bool) -> None:
        states = self.load()
        states[device_id] = is_on
        self.save(states)


class S7Client:
    def __init__(self, config: dict[str, Any]) -> None:
        plc = config.get("plc", {})
        self.host = str(plc.get("host", "192.168.0.1"))
        self.rack = int(plc.get("rack", 0))
        self.slot = int(plc.get("slot", 1))

    def _client(self) -> Any:
        if snap7 is None:
            raise RuntimeError("python-snap7 is not installed")

        client = snap7.client.Client()
        client.connect(self.host, self.rack, self.slot)
        if not client.get_connected():
            raise RuntimeError(f"Cannot connect to PLC at {self.host}")
        return client

    @staticmethod
    def parse_m_bit(tag: str) -> tuple[int, int]:
        raw = tag.strip().upper()
        if not raw.startswith("M") or "." not in raw:
            raise ValueError(f"Unsupported M bit tag: {tag}")

        byte_str, bit_str = raw[1:].split(".", 1)
        return int(byte_str), int(bit_str)

    @staticmethod
    def read_number(buffer: bytearray, offset: int, data_type: str, scale: float) -> float:
        normalized = data_type.strip().lower()
        if normalized == "real":
            if get_real is None:
                raise RuntimeError("python-snap7 is not installed")
            return float(get_real(buffer, offset)) * scale

        if normalized == "dword":
            if get_dword is None:
                raise RuntimeError("python-snap7 is not installed")
            return float(get_dword(buffer, offset)) * scale

        raise ValueError(f"Unsupported power tag type: {data_type}")

    def read_power(self, tags: dict[str, Any]) -> dict[str, float]:
        addresses = [int(tag["address"]) for tag in tags.values()]
        start = min(addresses)
        end = max(address + 4 for address in addresses)

        client = self._client()
        try:
            data = client.mb_read(start, end - start)
        finally:
            client.disconnect()

        values: dict[str, float] = {}
        for key, tag in tags.items():
            address = int(tag["address"])
            values[key] = round(
                self.read_number(
                    data,
                    address - start,
                    str(tag.get("type", "DWord")),
                    float(tag.get("scale", 1.0)),
                ),
                4,
            )

        return values

    def read_device_states(self, devices: list[dict[str, Any]]) -> dict[str, bool]:
        client = self._client()
        states: dict[str, bool] = {}

        try:
            for item in devices:
                byte_index, bit_index = self.parse_m_bit(str(item["statusTag"]))
                data = client.mb_read(byte_index, 1)
                if get_bool is None:
                    raise RuntimeError("python-snap7 is not installed")
                states[str(item["id"])] = bool(get_bool(data, 0, bit_index))
        finally:
            client.disconnect()

        return states

    def write_device_command(self, device: dict[str, Any], is_on: bool) -> None:
        byte_index, bit_index = self.parse_m_bit(str(device["commandTag"]))
        client = self._client()

        try:
            data = client.mb_read(byte_index, 1)
            if set_bool is None:
                raise RuntimeError("python-snap7 is not installed")
            set_bool(data, 0, bit_index, is_on)
            client.mb_write(byte_index, 1, data)
        finally:
            client.disconnect()


def create_app() -> Flask:
    config = load_config()
    devices = list(config.get("devices", []))
    mode = str(config.get("mode", "mock")).strip().lower()
    state_store = StateStore(devices)
    s7 = S7Client(config)

    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response: Any) -> Any:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return response

    def read_states() -> dict[str, bool]:
        if mode == "plc-real":
            return s7.read_device_states(devices)
        return state_store.load()

    @app.get("/health")
    def health() -> Any:
        return jsonify(
            {
                "ok": True,
                "service": "smart-home-server",
                "mode": mode,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    @app.get("/api/power/current")
    def power_current() -> Any:
        try:
            if mode == "plc-real":
                values = s7.read_power(config.get("powerTags", {}))
                source = "plc-s7-1200"
            else:
                states = state_store.load()
                active_power_w = sum(float(item["power"]) for item in devices if states.get(str(item["id"]), False))
                values = {
                    "voltage": 220.0,
                    "current": round(active_power_w / 220.0, 4),
                    "power_kw": round(active_power_w / 1000.0, 4),
                    "energy_kwh": 12.3,
                }
                source = "mock"

            return jsonify(
                {
                    "voltage": values.get("voltage"),
                    "current": values.get("current"),
                    "power_kw": values.get("power_kw"),
                    "energy_kwh": values.get("energy_kwh"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "source": source,
                }
            )
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.get("/api/devices")
    def get_devices() -> Any:
        try:
            return jsonify({"devices": group_devices(devices, read_states())})
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.post("/api/devices/<device_id>/turn-on")
    def turn_on(device_id: str) -> Any:
        return set_device(device_id, True)

    @app.post("/api/devices/<device_id>/turn-off")
    def turn_off(device_id: str) -> Any:
        return set_device(device_id, False)

    def set_device(device_id: str, is_on: bool) -> Any:
        device = next((item for item in devices if str(item["id"]) == device_id), None)
        if not device:
            return jsonify({"ok": False, "error": f"Unknown device: {device_id}"}), 404

        try:
            if mode == "plc-real":
                s7.write_device_command(device, is_on)

            state_store.set_state(device_id, is_on)
            return jsonify({"ok": True, "device_id": device_id, "isOn": is_on})
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.post("/api/scenes/<scene>")
    def apply_scene(scene: str) -> Any:
        states = state_store.load()

        if scene == "sleep":
            target = {str(item["id"]): False for item in devices if item["type"] in {"light", "fan"}}
        elif scene == "work":
            target = {str(item["id"]): False for item in devices}
        elif scene in {"morning", "weekend"}:
            target = {str(item["id"]): True for item in devices}
        else:
            return jsonify({"ok": False, "error": f"Unknown scene: {scene}"}), 400

        for device_id, is_on in target.items():
            device = next(item for item in devices if str(item["id"]) == device_id)
            if mode == "plc-real":
                s7.write_device_command(device, is_on)
            states[device_id] = is_on

        state_store.save(states)
        return jsonify({"ok": True, "scene": scene})

    @app.post("/api/assistant/chat")
    def assistant_chat() -> Any:
        payload = request.get_json(silent=True) or {}
        text = str(payload.get("text", "")).strip()

        if not text:
            return jsonify({"reply": "Ban hay nhap lenh can dieu khien hoac cau hoi ve dien nang."})

        intent = parse_intent(text, devices)

        if intent["intent"] == "get_power_current":
            power = power_current().json
            return jsonify({"intent": intent, "reply": f"Cong suat hien tai khoang {power.get('power_kw')} kW."})

        if intent["intent"] == "turn_off_all":
            apply_scene("work")
            return jsonify({"intent": intent, "reply": "Da gui lenh tat tat ca thiet bi."})

        if intent["intent"] == "turn_on_all":
            apply_scene("weekend")
            return jsonify({"intent": intent, "reply": "Da gui lenh bat tat ca thiet bi."})

        if intent["intent"] == "apply_scene":
            apply_scene(str(intent["scene"]))
            return jsonify({"intent": intent, "reply": f"Da kich hoat canh {intent['scene']}."})

        if intent["intent"] in {"turn_on_device", "turn_off_device"}:
            is_on = intent["intent"] == "turn_on_device"
            set_device(str(intent["device_id"]), is_on)
            action = "bat" if is_on else "tat"
            return jsonify({"intent": intent, "reply": f"Da gui lenh {action} {intent.get('device_name', intent['device_id'])}."})

        if intent["intent"] == "set_filtered_devices":
            states = read_states()
            affected = 0
            for device in devices:
                if intent.get("room_id") and device.get("roomId") != intent["room_id"]:
                    continue
                if intent.get("device_type") and device.get("type") != intent["device_type"]:
                    continue
                set_device(str(device["id"]), bool(intent["is_on"]))
                states[str(device["id"])] = bool(intent["is_on"])
                affected += 1
            state_store.save(states)
            return jsonify({"intent": intent, "reply": f"Da gui lenh cho {affected} thiet bi phu hop."})

        if intent["intent"] == "list_devices":
            grouped = group_devices(devices, read_states())
            total = sum(len(items) for items in grouped.values())
            return jsonify({"intent": intent, "reply": f"He thong dang co {total} thiet bi trong 4 khu vuc."})

        if intent["intent"] == "get_forecast":
            return jsonify({"intent": intent, "reply": "Chuc nang du bao se doc Forecast API sau khi co du lieu lich su tu PLC."})

        return jsonify({"intent": intent, "reply": f"Minh chua hieu ro lenh: {text}. Ban co the noi lai ngan hon, vi du: bat den phong khach."})

    return app


if __name__ == "__main__":
    loaded = load_config()
    server_config = loaded.get("server", {})
    create_app().run(
        host=str(server_config.get("host", "0.0.0.0")),
        port=int(server_config.get("port", 5001)),
        debug=bool(server_config.get("debug", False)),
    )
