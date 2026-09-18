#!/usr/bin/env python3
"""Z WCEP-10 robi corpus/<temat>/article_*.json - kilka dlugich artykulow o tym samym evencie."""

import json
import re
import shutil
from pathlib import Path

from download_wcep import RAW_FILE, download_wcep

OUT = Path(__file__).resolve().parent / "corpus"
LIMIT = 50
MIN_CHARS = 2000
MIN_COVERAGE = 0.75
MIN_ARTICLES = 3
MAX_ARTICLES = 5
STOP = {
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by",
    "from", "as", "is", "are", "was", "were", "be", "been", "it", "its", "this", "that",
    "these", "those", "has", "have", "had", "will", "would", "can", "could", "may",
}


def slug(summary: str) -> str:
    words = re.findall(r"[a-z0-9]+", summary.lower())[:8]
    return "_".join(words)[:60] or "topic"


def first_line(text: str, fallback: str) -> str:
    for line in text.splitlines():
        if line.strip():
            return line.strip()[:180]
    return fallback


def tokens(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", text.lower()) if word not in STOP and len(word) > 2}


def coverage(summary: str, article: str) -> float:
    summary_words = tokens(summary)
    if not summary_words:
        return 0.0
    return len(summary_words & tokens(article)) / len(summary_words)


def related_articles(summary: str, documents: list[str]) -> list[str]:
    scored = []
    for text in documents:
        text = text.strip()
        if len(text) < MIN_CHARS:
            continue
        score = coverage(summary, text)
        if score >= MIN_COVERAGE:
            scored.append((score, len(text), text))
    scored.sort(reverse=True)
    return [text for _, _, text in scored[:MAX_ARTICLES]]


def convert() -> None:
    raw = download_wcep() if not RAW_FILE.exists() else RAW_FILE
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    topics = []
    with raw.open(encoding="utf-8") as handle:
        for index, line in enumerate(handle):
            if len(topics) >= LIMIT:
                break
            row = json.loads(line)
            documents = row.get("document") or []
            if isinstance(documents, str):
                continue
            articles = related_articles(row.get("summary", ""), documents)
            if len(articles) < MIN_ARTICLES:
                continue

            name = f"{slug(row.get('summary', ''))}__{index:05d}"
            folder = OUT / name
            folder.mkdir()
            files = []
            for i, text in enumerate(articles):
                file_name = f"article_{i}.json"
                (folder / file_name).write_text(
                    json.dumps(
                        {"title": first_line(text, file_name), "text": text},
                        ensure_ascii=False,
                        indent=2,
                    )
                    + "\n",
                    encoding="utf-8",
                )
                files.append(file_name)
            topics.append({"folder": name, "articles": files})

    topics.sort(key=lambda item: item["folder"])
    (OUT / "topics.json").write_text(json.dumps(topics, indent=2) + "\n", encoding="utf-8")
    print(f"Zapisano {len(topics)} tematow do {OUT}")


if __name__ == "__main__":
    convert()
