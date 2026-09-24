import json
import re
import urllib.request

MODEL = "qwen3:8b"
OLLAMA = "http://127.0.0.1:11434/api/generate"
TAGS = "http://127.0.0.1:11434/api/tags"


def list_models() -> list[str]:
    try:
        with urllib.request.urlopen(TAGS, timeout=5) as response:
            data = json.loads(response.read().decode())
    except OSError:
        return [MODEL]
    names = [str(item.get("name") or "") for item in data.get("models") or []]
    names = [name for name in names if name]
    if MODEL not in names:
        names.insert(0, MODEL)
    return names


def generate(prompt: str, json_mode: bool = False, model: str | None = None) -> str:
    payload = {
        "model": model or MODEL,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {"temperature": 0},
    }
    if json_mode:
        payload["format"] = "json"
    body = json.dumps(payload).encode()
    request = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        data = json.loads(response.read().decode())
    text = (data.get("response") or "").strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S | re.I).strip()
    if not text:
        raise RuntimeError("Model nic nie zwrocil.")
    return text
