from pathlib import Path

from assign_windows import assign_windows_to_source
from context_windows import make_context_windows, sentences_from_json
from embeddings import embed_windows
from judge import pairs_from_groups


def windows_from_article(path: Path) -> list[dict]:
    return embed_windows(make_context_windows(sentences_from_json(path)))


def _vec(value) -> list[float] | None:
    if value is None:
        return None
    return [float(x) for x in value]


def public_window(window: dict) -> dict:
    return {
        "index": window["index"],
        "previous": window["previous"],
        "leading": window["leading"],
        "next": window["next"],
        "previous_embedding": _vec(window["previous_embedding"]),
        "leading_embedding": _vec(window["leading_embedding"]),
        "next_embedding": _vec(window["next_embedding"]),
    }


def analyze(folder: Path, source_name: str, other_names: list[str]) -> dict:
    source = windows_from_article(folder / source_name)
    others = [windows_from_article(folder / name) for name in other_names]
    groups = assign_windows_to_source(source, others)

    articles = [{"file": source_name, "windows": [public_window(window) for window in source]}]
    for name, windows in zip(other_names, others):
        articles.append({"file": name, "windows": [public_window(window) for window in windows]})

    matches = []
    for group in groups:
        matches.append(
            {
                "index": group["source"]["index"],
                "leading": group["source"]["leading"],
                "assigned": [
                    {
                        "file": other_names[item["article_index"]],
                        "index": item["index"],
                        "leading": item["leading"],
                        "score": item["score"],
                    }
                    for item in group["assigned"]
                ],
            }
        )

    return {
        "articles": articles,
        "matches": matches,
        "pairs": pairs_from_groups(groups, other_names),
        "labels": ["duplicate", "fusion", "new", "delete"],
    }
