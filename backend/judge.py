import json
import re

from llm import generate

LABELS = ("duplicate", "fusion", "new", "delete")

PRE_PROMPT = """Compare SOURCE and OTHER. Reply with compact JSON only, nothing else,
no explanation, no markdown. Do not copy the examples.

Schema: {"claim": "same" | "diff" | "junk", "label": "duplicate" | "fusion" | "new" | "delete"}

claim:
same — OTHER makes the same claim as SOURCE (same who + what).
diff — OTHER makes a different claim.
junk — OTHER makes no claim at all: a question, a reaction, small talk,
       a remark about the interview/article itself, or boilerplate.

label:
duplicate — claim is same, only wording differs.
fusion — claim is same, OTHER adds a name, number, quote, or time.
new — claim is diff, but still that same deal / meeting / call.
delete — claim is diff or junk: wrong topic, or not a claim at all.

A: Riyadh and Tehran renewed diplomatic ties.
B: Iran and Saudi Arabia renewed diplomatic ties.
{"claim": "same", "label": "duplicate"}

A: Riyadh and Tehran renewed diplomatic ties.
B: Iran and Saudi agreed to restore relations and reopen embassies.
{"claim": "same", "label": "fusion"}

A: Riyadh and Tehran renewed diplomatic ties.
B: China brokered the deal in Beijing after two years of talks.
{"claim": "diff", "label": "new"}

A: Riyadh and Tehran renewed diplomatic ties.
B: Nonalignment was the default in the last bipolar period.
{"claim": "diff", "label": "delete"}

A: Riyadh and Tehran renewed diplomatic ties.
B: HOST: We're going to have to leave it there.
{"claim": "junk", "label": "delete"}

A: Riyadh and Tehran renewed diplomatic ties.
B: Do you think that was the right call?
{"claim": "junk", "label": "delete"}
"""


def window_text(window: dict) -> dict:
    return {
        "index": window["index"],
        "previous": window.get("previous"),
        "leading": window["leading"],
        "next": window.get("next"),
    }


def format_window(title: str, window: dict) -> str:
    return (
        f"{title}\n"
        f"prev: {window.get('previous') or '-'}\n"
        f"lead: {window['leading']}\n"
        f"next: {window.get('next') or '-'}"
    )


def example(source: dict, other: dict, prompt: str = PRE_PROMPT) -> str:
    return (
        f"{prompt}\n"
        f"{format_window('SOURCE', source)}\n\n"
        f"{format_window('OTHER', other)}\n\n"
        "JSON:"
    )


def pairs_from_groups(groups: list[dict], other_names: list[str]) -> list[dict]:
    pairs = []
    for group in groups:
        source = window_text(group["source"])
        for item in group["assigned"]:
            other = window_text(item)
            pairs.append(
                {
                    "file": other_names[item["article_index"]],
                    "score": item["score"],
                    "source": source,
                    "other": other,
                    "label": None,
                }
            )
    return pairs


def same_lead(source: dict, other: dict) -> bool:
    left = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", (source.get("leading") or "").lower())).strip()
    right = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", (other.get("leading") or "").lower())).strip()
    return bool(left) and left == right


SPEAKER_TAG = re.compile(r"^[A-Z][A-Za-z .]{0,24}:\s*")


def strip_speaker_tag(text: str) -> str:
    """Zdejmuje etykiete mowcy z transkryptu (np. FRANK: Thank you. -> Thank you.)."""
    return SPEAKER_TAG.sub("", text, count=1)


def junk_lead(window: dict) -> bool:
    raw = (window.get("leading") or "").strip()
    if not raw:
        return True

    # Liczymy slowa i sprawdzamy ksztalt zdania bez etykiety mowcy z transkryptu,
    # inaczej "BARNEY FRANK: Thank you." wyglada na dluzsze niz jest naprawde.
    text = strip_speaker_tag(raw)
    if not text:
        return True
    if len(re.findall(r"[A-Za-z]+", text)) < 4:
        return True
    # Pytanie prowadzacego albo zdanie urwane w polowie to nie jest fakt do fuzji.
    if text.endswith("?"):
        return True
    if text.startswith("...") or text.endswith("..."):
        return True

    low = text.lower()
    if re.match(r"^(in this photo|photograph:|photo:|advertisement\b|also read:)", low):
        return True
    return bool(
        re.search(
            r"privacy policy|recaptcha|newsletter|contributing:|additional reporting|"
            r"skip past newsletter|copyright|transcript provided by",
            low,
        )
    )


def parse_label(raw: str) -> str:
    text = re.sub(r"<think>.*?</think>", " ", raw, flags=re.S | re.I).strip()
    try:
        data = json.loads(text)
        claim = str(data.get("claim", "")).strip().lower()
        label = str(data.get("label", "")).strip().lower()
    except (json.JSONDecodeError, AttributeError):
        raise ValueError(f"Model nie zwrocil poprawnego JSON: {raw[:120]}")
    if label not in LABELS:
        raise ValueError(f"Nieznany label w JSON: {raw[:120]}")
    if claim == "junk":
        return "delete"
    if claim == "diff" and label in ("fusion", "duplicate"):
        return "delete"
    if claim == "same" and label in ("new", "delete"):
        return "fusion"
    return label


def classify(source: dict, other: dict, model: str | None = None) -> str:
    if same_lead(source, other):
        return "duplicate"
    if junk_lead(other):
        return "delete"
    return parse_label(generate(example(source, other), json_mode=True, model=model))
