from llm import generate

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


def fuse(sentences: list[str], model: str | None = None) -> str:
    clean = [text.strip() for text in sentences if text.strip()]
    if len(clean) < 2:
        raise ValueError("Podaj co najmniej dwa zdania.")

    numbered = "\n".join(f"{i}. {text}" for i, text in enumerate(clean, start=1))
    return generate(f"{MASTER}{numbered}", model=model)
