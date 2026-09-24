#!/usr/bin/env python3
"""1-NN + sedzia + PDF w terminalu. Bez frontendu i bez API.

  python run_judge.py <folder> [--model qwen3:8b]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from analyze import analyze
from judge import LABELS, classify
from llm import MODEL
from report import save_report

CORPUS = Path(__file__).resolve().parent / "corpus"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("folder")
    parser.add_argument("--source", default="article_0.json")
    parser.add_argument("--model", default=MODEL)
    args = parser.parse_args()
    folder = Path(args.folder).name
    path = CORPUS / folder
    others = [p.name for p in sorted(path.glob("article_*.json")) if p.name != args.source]
    if not others:
        raise SystemExit(f"Brak artykulow w {path}")

    print(f"1-NN {path}  source={args.source}  model={args.model}")
    data = analyze(path, args.source, others)
    pairs = data["pairs"]
    print(f"par: {len(pairs)}")

    for i, pair in enumerate(pairs, start=1):
        pair["label"] = classify(pair["source"], pair["other"], args.model)
        print(f"{i}/{len(pairs)}  {pair['score']:.3f}  {pair['label']}", flush=True)

    for label in LABELS:
        scores = [p["score"] for p in pairs if p["label"] == label]
        if scores:
            print(f"{label}: {len(scores)} min {min(scores):.3f} max {max(scores):.3f}")
        else:
            print(f"{label}: 0")

    print(save_report(folder, args.source, others, pairs, args.model))


if __name__ == "__main__":
    main()
