import json
import re
from pathlib import Path


def sentences_from_json(json_path: str | Path) -> list[str]:
    """Wczytuje plik JSON z polem 'text' i dzieli tekst na zdania."""
    raw = Path(json_path).read_text(encoding="utf-8")
    article = json.loads(raw, strict=False)

    text = re.sub(r"\s+", " ", str(article.get("text", "")).strip())
    if not text:
        return []

    parts = re.split(r"(?<=[.!?])\s+", text)
    return [part.strip() for part in parts if part.strip()]


def make_context_windows(sentences: list[str]) -> list[dict]:
    """Dla każdego zdania wiodącego Sn tworzy okno (Sn-1, Sn, Sn+1)."""
    last_index = len(sentences) - 1
    windows = []

    for index, leading in enumerate(sentences):
        windows.append(
            {
                "index": index,
                "previous": sentences[index - 1] if index > 0 else None,
                "leading": leading,
                "next": sentences[index + 1] if index < last_index else None,
            }
        )

    return windows
