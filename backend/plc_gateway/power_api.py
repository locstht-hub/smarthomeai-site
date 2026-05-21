from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify

try:
    import snap7
    from snap7.util import get_dword, get_real
except Exception:  # pragma: no cover
    snap7 = None  # type: ignore
    get_dword = None  # type: ignore
    get_real = None  # type: ignore


CONFIG_PATH = Path(__file__).with_name("power_config.json")


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        example = Path(__file__).with_name("power_config.example.json")
        raise FileNotFoundError(f"Missing {CONFIG_PATH.name}. Copy {example.name} to {CONFIG_PATH.name}.")

    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


class S7PowerReader:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        plc = config.get("plc", {})
        self.host = str(plc.get("host", "192.168.0.1"))
        self.rack = int(plc.get("rack", 0))
        self.slot = int(plc.get("slot", 1))
        self.timeout_ms = int(plc.get("timeoutMs", 3000))
        self.tags = config.get("tags", {})

    @staticmethod
    def _read_value(buffer: bytearray, offset: int, data_type: str, scale: float) -> float:
        normalized = data_type.strip().lower()
        if normalized == "real":
            if get_real is None:
                raise RuntimeError("python-snap7 is not installed")
            return float(get_real(buffer, offset)) * scale

        if normalized == "dword":
            if get_dword is None:
                raise RuntimeError("python-snap7 is not installed")
            return float(get_dword(buffer, offset)) * scale

        raise ValueError(f"Unsupported data type: {data_type}. Use 'DWord' or 'Real'.")

    def read_current(self) -> dict[str, Any]:
        if snap7 is None:
            raise RuntimeError("python-snap7 is not installed. Run: pip install -r requirements.txt")

        addresses = [int(tag["address"]) for tag in self.tags.values()]
        start = min(addresses)
        end = max(address + 4 for address in addresses)
        length = end - start

        client = snap7.client.Client()

        try:
            client.connect(self.host, self.rack, self.slot)
            if not client.get_connected():
                raise RuntimeError(f"Cannot connect to PLC at {self.host}")

            data = client.mb_read(start, length)
        finally:
            client.disconnect()

        values: dict[str, float] = {}
        raw_tags: dict[str, Any] = {}
        for key, tag in self.tags.items():
            address = int(tag["address"])
            offset = address - start
            data_type = str(tag.get("type", "DWord"))
            scale = float(tag.get("scale", 1.0))
            value = self._read_value(data, offset, data_type, scale)
            values[key] = round(value, 4)
            raw_tags[key] = {
                "name": tag.get("name", key),
                "address": f"MD{address}",
                "type": data_type,
                "scale": scale,
            }

        return {
            "voltage": values.get("voltage"),
            "current": values.get("current"),
            "power_kw": values.get("power_kw"),
            "energy_kwh": values.get("energy_kwh"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "plc-s7-1200",
            "plc": {
                "host": self.host,
                "rack": self.rack,
                "slot": self.slot,
            },
            "raw_tags": raw_tags,
        }


def mock_current(config: dict[str, Any]) -> dict[str, Any]:
    plc = config.get("plc", {})
    return {
        "voltage": 220.0,
        "current": 2.5,
        "power_kw": 0.55,
        "energy_kwh": 12.3,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "mock",
        "plc": {
            "host": plc.get("host", "192.168.0.1"),
            "rack": plc.get("rack", 0),
            "slot": plc.get("slot", 1),
        },
    }


def create_app() -> Flask:
    app = Flask(__name__)
    config = load_config()
    reader = S7PowerReader(config)

    @app.get("/health")
    def health() -> Any:
        return jsonify({"ok": True, "service": "plc-power-api"})

    @app.get("/api/power/current")
    def current_power() -> Any:
        mode = str(config.get("mode", "mock")).lower().strip()
        if mode == "mock":
            return jsonify(mock_current(config))

        try:
            return jsonify(reader.read_current())
        except Exception as exc:
            if bool(config.get("allowMockOnPlcError", True)):
                payload = mock_current(config)
                payload["warning"] = str(exc)
                return jsonify(payload), 200

            return jsonify({"ok": False, "error": str(exc)}), 500

    return app


if __name__ == "__main__":
    loaded_config = load_config()
    server = loaded_config.get("server", {})
    host = str(server.get("host", "0.0.0.0"))
    port = int(server.get("port", 5001))
    debug = bool(server.get("debug", False))
    create_app().run(host=host, port=port, debug=debug)
