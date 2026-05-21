# Assistant Intent Fine-tuning with Unsloth

Muc tieu: fine-tune mot model nho de bien cau lenh tieng Viet thanh JSON intent cho endpoint:

```text
POST /api/assistant/chat
```

## Intent schema

```json
{"intent":"get_power_current"}
{"intent":"turn_off_all"}
{"intent":"turn_on_all"}
{"intent":"apply_scene","scene":"sleep"}
{"intent":"turn_on_device","device_id":"living_main_light"}
{"intent":"turn_off_device","device_id":"living_main_light"}
{"intent":"set_filtered_devices","is_on":false,"room_id":"living","device_type":"light"}
{"intent":"list_devices"}
{"intent":"get_forecast"}
{"intent":"unknown"}
```

## Dataset

File:

```text
dataset.jsonl
```

Moi dong gom:

```json
{"instruction":"Bật đèn phòng khách","output":"{\"intent\":\"turn_on_device\",\"device_id\":\"living_main_light\"}"}
```

## Chay tren Colab

```bash
pip install -r requirements.txt
python train_unsloth_intent.py \
  --dataset dataset.jsonl \
  --model unsloth/Qwen2.5-1.5B-Instruct-bnb-4bit \
  --output_dir assistant-intent-lora
```

## Sau khi train

Model se luu LoRA adapter vao:

```text
assistant-intent-lora/
```

Buoc sau co the:

1. Test model tra JSON dung.
2. Export GGUF/Ollama neu can chay local.
3. Thay rule parser trong `backend/smart_home_server/assistant_intents.py` bang model inference.

