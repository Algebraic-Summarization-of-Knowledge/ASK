#!/usr/bin/env python3
"""Z DiverseSumm robi corpus/<temat>/article_*.json — tylko długie, pełne artykuły."""

import json
import re
import shutil
from pathlib import Path

from download_diversesumm import RAW_FILE, download_diversesumm

OUT = Path(__file__).resolve().parent / "corpus"
LIMIT = 50
MIN_CHARS = 2000
MIN_ARTICLES = 3
MAX_ARTICLES = 5


def slug(title: str) -> str:
    words = re.findall(r"[a-z0-9]+", title.lower())[:8]
    return "_".join(words)[:60] or "topic"


def pick_articles(story: dict) -> list[dict]:
    seen = set()
    picked = []
    rows = sorted(
        story.get("articles") or [],
        key=lambda item: len(str(item.get("content") or "").strip()),
        reverse=True,
    )
    for item in rows:
        text = str(item.get("content") or "").strip()
        if len(text) < MIN_CHARS:
            continue
        key = " ".join(text.split())[:240]
        if key in seen:
            continue
        seen.add(key)
        title = str(item.get("title") or "").strip() or text.splitlines()[0][:180]
        picked.append({"title": title[:180], "text": text})
        if len(picked) == MAX_ARTICLES:
            break
    return picked


def convert() -> None:
    raw = download_diversesumm() if not RAW_FILE.exists() else RAW_FILE
    stories = json.loads(raw.read_text(encoding="utf-8"))
    ranked = []
    for story in stories:
        articles = pick_articles(story)
        if len(articles) < MIN_ARTICLES:
            continue
        title = articles[0]["title"]
        ranked.append((min(len(item["text"]) for item in articles), title, articles))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    topics = []
    for index, (_, title, articles) in enumerate(ranked[:LIMIT]):
        name = f"{slug(title)}__{index:05d}"
        folder = OUT / name
        folder.mkdir()
        files = []
        for i, article in enumerate(articles):
            file_name = f"article_{i}.json"
            (folder / file_name).write_text(
                json.dumps(
                    {"title": article["title"], "text": article["text"]},
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
