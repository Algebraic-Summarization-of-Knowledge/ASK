import json
import urllib.request

MODEL = "llama3.2"
OLLAMA = "http://127.0.0.1:11434/api/generate"

MASTER = """You fuse news sentences about the same event into one text.

Rules:
- Keep every fact, number, name, date, place, quote and attribution.
- Keep uncertainty words (reportedly, allegedly, according to).
- Do not add facts that are not in the sentences.
- If two sentences conflict, keep both and mark the conflict.
- Merge duplicates. Do not drop unique details.
- Write in the same language as the input.
- Output only the fused text, nothing else.

Sentences:
"""


def fuse(sentences: list[str]) -> str:
    clean = [text.strip() for text in sentences if text.strip()]
    if len(clean) < 2:
        raise ValueError("Podaj co najmniej dwa zdania.")

    numbered = "\n".join(f"{i}. {text}" for i, text in enumerate(clean, start=1))
    body = json.dumps(
        {
            "model": MODEL,
            "prompt": f"{MASTER}{numbered}",
            "stream": False,
            "options": {"temperature": 0},
        }
    ).encode()
    request = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = json.loads(response.read().decode())
    text = (data.get("response") or "").strip()
    if not text:
        raise RuntimeError("Model nic nie zwrocil.")
    return text
