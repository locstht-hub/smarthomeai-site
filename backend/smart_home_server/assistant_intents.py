from __future__ import annotations

import json
import re
import unicodedata
from typing import Any


Intent = dict[str, Any]


def normalize_text(text: str) -> str:
    lowered = text.lower().replace("đ", "d")
    normalized = unicodedata.normalize("NFD", lowered)
    without_marks = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", without_marks).strip()


def _contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


ROOM_ALIASES = {
    "living": ["phong khach", "khach", "living"],
    "bedroom": ["phong ngu", "ngu", "bedroom"],
    "kitchen": ["nha bep", "phong bep", "bep", "kitchen"],
    "garage": ["garage", "gara", "nha xe", "xe"],
}

DEVICE_TYPE_ALIASES = {
    "light": ["den", "bong den"],
    "fan": ["quat", "quat tran", "quat hut"],
    "ac": ["may lanh", "dieu hoa", "ac"],
    "outlet": ["o cam", "tu lanh", "cua cuon", "motor"],
}


def detect_room(text: str) -> str | None:
    for room_id, aliases in ROOM_ALIASES.items():
        if _contains_any(text, aliases):
            return room_id
    return None


def detect_device_type(text: str) -> str | None:
    for device_type, aliases in DEVICE_TYPE_ALIASES.items():
        if _contains_any(text, aliases):
            return device_type
    return None


def find_device(text: str, devices: list[dict[str, Any]]) -> dict[str, Any] | None:
    room_id = detect_room(text)
    device_type = detect_device_type(text)

    scored: list[tuple[int, dict[str, Any]]] = []
    for device in devices:
        score = 0
        device_name = normalize_text(str(device.get("name", "")))
        if room_id and device.get("roomId") == room_id:
            score += 3
        if device_type and device.get("type") == device_type:
            score += 3
        for token in device_name.split():
            if len(token) >= 3 and token in text:
                score += 1
        if score > 0:
            scored.append((score, device))

    if not scored:
        return None

    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1]


def parse_intent(user_text: str, devices: list[dict[str, Any]]) -> Intent:
    text = normalize_text(user_text)

    if not text:
        return {"intent": "unknown"}

    if _contains_any(text, ["cong suat", "dang dung bao nhieu dien", "dien nang hien tai", "muc tieu thu hien tai"]):
        return {"intent": "get_power_current"}

    if _contains_any(text, ["danh sach thiet bi", "co nhung thiet bi nao", "liet ke thiet bi"]):
        return {"intent": "list_devices"}

    if _contains_any(text, ["du bao", "toi nay", "24h", "24 gio", "ngay mai"]):
        return {"intent": "get_forecast"}

    if _contains_any(text, ["bat che do ngu", "che do ngu", "di ngu", "toi di ngu"]):
        return {"intent": "apply_scene", "scene": "sleep"}

    if _contains_any(text, ["vang nha", "di lam", "ra ngoai", "toi ra ngoai"]):
        return {"intent": "apply_scene", "scene": "work"}

    if _contains_any(text, ["buoi sang", "chao buoi sang"]):
        return {"intent": "apply_scene", "scene": "morning"}

    if _contains_any(text, ["cuoi tuan", "che do cuoi tuan"]):
        return {"intent": "apply_scene", "scene": "weekend"}

    wants_on = _contains_any(text, ["bat ", "mo ", "kich hoat"])
    wants_off = _contains_any(text, ["tat ", "dong ", "ngat "])
    has_all = _contains_any(text, ["tat ca", "het thiet bi", "toan bo"])
    room_id = detect_room(text)
    device_type = detect_device_type(text)

    if (wants_on or wants_off) and has_all and (room_id or device_type):
        return {
            "intent": "set_filtered_devices",
            "is_on": wants_on,
            "room_id": room_id,
            "device_type": device_type,
        }

    if wants_off and has_all:
        return {"intent": "turn_off_all"}

    if wants_on and has_all:
        return {"intent": "turn_on_all"}

    if wants_on or wants_off:
        device = find_device(text, devices)
        if device:
            return {
                "intent": "turn_on_device" if wants_on else "turn_off_device",
                "device_id": device["id"],
                "device_name": device["name"],
            }

        if room_id or device_type:
            return {
                "intent": "set_filtered_devices",
                "is_on": wants_on,
                "room_id": room_id,
                "device_type": device_type,
            }

    return {"intent": "unknown", "text": user_text}


def intent_to_json(intent: Intent) -> str:
    return json.dumps(intent, ensure_ascii=False, separators=(",", ":"))
