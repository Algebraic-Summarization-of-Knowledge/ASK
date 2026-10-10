import os
from functools import lru_cache

MODEL = "gpt-5-mini"

MODELS = [
    "gpt-5-nano",
    "gpt-5-mini",
    "gpt-5.4-nano",
    "gpt-5.4-mini",
    "gpt-5.4",
]

def list_models() -> list[str]:
    return MODELS

@lru_cache(maxsize=1)
def _client():
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("Zainstaluj klienta API: pip install openai") from exc
    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("Ustaw zmienna srodowiskowa OPENAI_API_KEY.")
    return OpenAI(timeout=120.0, max_retries=2)

def generate(prompt: str, json_mode: bool = False, model: str | None = None) -> str:
    kwargs = {
        "model": model or MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = _client().chat.completions.create(**kwargs)
    choice = response.choices[0]
    if choice.finish_reason == "length":
        raise RuntimeError("Odpowiedz modelu zostala ucieta; zwieksz limit tokenow.")
    text = (choice.message.content or "").strip()
    if not text:
        raise RuntimeError("Model nic nie zwrocil.")
    return text
