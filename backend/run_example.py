from pathlib import Path

from assign_windows import assign_windows_to_source
from context_windows import make_context_windows, sentences_from_json
from embeddings import embed_windows


ROOT = Path(__file__).resolve().parent.parent
ARTICLE_DIR = ROOT / "corpus" / "first_polish_hantavirus_case_09_05_2026"


def windows_from_article(path: Path) -> list[dict]:
    sentences = sentences_from_json(path)
    return embed_windows(make_context_windows(sentences))


print("Loading articles")

source = windows_from_article(ARTICLE_DIR / "article_tvp.json")
other = windows_from_article(ARTICLE_DIR / "article_polskieradio.json")
result = assign_windows_to_source(source, [other])

print("rdy\n")

for group in result:
    if not group["assigned"]:
        continue
    print("SOURCE:", group["source"]["leading"][:120])
    for item in group["assigned"]:
        print(f"  {item['score']:.3f}  {item['leading'][:100]}")
    print()
