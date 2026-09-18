import json
import re
from pathlib import Path

DOT = "<DOT>"
ABBREV = re.compile(
    r"\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|Inc|Ltd|Co|St|Gen|Rep|Sen|Gov|Rev|No|etc|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|"
    r"U\.S|U\.K|E\.U|e\.g|i\.e|a\.m|p\.m)\.",
    re.I,
)
INITIAL = re.compile(r"\b[A-Z]\.")


def split_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    protected = ABBREV.sub(lambda match: match.group(0)[:-1] + DOT, text)
    protected = INITIAL.sub(lambda match: match.group(0)[:-1] + DOT, protected)
    return [part.replace(DOT, ".").strip() for part in re.split(r"(?<=[.!?])\s+", protected) if part.strip()]


def sentences_from_json(json_path: str | Path) -> list[str]:
    article = json.loads(Path(json_path).read_text(encoding="utf-8"), strict=False)
    return split_sentences(str(article.get("text", "")))


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
