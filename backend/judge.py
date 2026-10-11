import json
import re

from llm import generate

LABELS = ("duplicate", "fusion", "new", "delete")

PRE_PROMPT = """You are a semantic claim classifier for multi-document
news summarization.

Compare SOURCE and OTHER and decide how the main factual information in OTHER relates to SOURCE.

Each text contains:
- prev: preceding sentence (context only)
- lead: sentence being classified
- next: following sentence (context only)

IMPORTANT: Classify the LEAD sentences.
Use prev and next to resolve references, identify the event and understand the surrounding context. Do not classify neighboring sentences as separate claims.

Return only valid JSON:
{"claim": "same" | "diff" | "junk",
 "label": "duplicate" | "fusion" | "new" | "delete"}

CLAIM RELATION:

same:
SOURCE and OTHER express the same core factual assertion.
They describe the same action, state, or development
involving the same relevant entities.
OTHER may provide additional specific details.

diff:
OTHER expresses a distinct factual assertion.
This includes a different action, cause, consequence,
reaction, opinion, decision, or development.

junk:
OTHER contains no relevant factual assertion.
Examples: pure greetings, filler, navigation text,
or questions without factual content.

CLASSIFICATION LABELS:

duplicate:
The core claim is the same and OTHER adds no materially
new information. Differences in wording are irrelevant.

fusion:
The core claim is the same, but OTHER adds factual details
such as names, dates, numbers, locations, quotations,
qualifications, or other specific attributes.

new:
OTHER expresses a distinct factual claim that belongs
to the same identifiable event, decision, process,
or closely connected development as SOURCE.
This includes causes, effects, reactions, and perspectives that introduce separate claims.

delete:
OTHER is unrelated to the specific event or process
described in SOURCE, or contains no usable claim.
General thematic similarity alone is insufficient.

DECISION RULES:

1. Identify the core claim in SOURCE and OTHER:
   who or what, action or state, and relevant context.

2. Determine whether both leads assert the same
   core factual proposition.
   If yes:
   - no new details -> duplicate
   - additional details -> fusion

3. If they assert different propositions:
   - same identifiable event or process -> new
   - unrelated event or only broad topic similarity -> delete

4. Do NOT use fusion merely because two sentences
   can be combined into a coherent paragraph.

5. A shared topic, person, organization, or keyword
   does not prove that two claims are the same.

6. Distinguish a statement from a statement ABOUT it.
   A person's support for a policy and another person's
   criticism of its consequences are different claims.

7. Questions and interview transcripts may contain
   relevant factual assertions or attributed quotations.
   Do not discard them solely because they are questions.
   Do not turn allegations or opinions into established facts.

8. If a lead contains several claims, classify its
   main assertion. Use context to resolve ambiguity.
   Do not invent missing information.

9. Contradictory claims about the same event are not
   duplicates. Treat distinct conflicting assertions
   as new rather than merging them as established facts.

10. Interview and transcript content: Distinguish substantive event information from
conversational or editorial content.

Classify as delete when OTHER is only:
- an introduction of a speaker without a new
  event-relevant fact,
- a conversational reaction or interruption,
- an evaluation of someone's suitability to comment,
- a vague remark without recoverable factual meaning.

EXAMPLES:

SOURCE: Riyadh and Tehran renewed diplomatic ties.
OTHER: Iran and Saudi Arabia renewed diplomatic ties.
{"claim":"same","label":"duplicate"}

SOURCE: Riyadh and Tehran renewed diplomatic ties.
OTHER: Iran and Saudi Arabia agreed to restore
relations and reopen their embassies.
{"claim":"same","label":"fusion"}

SOURCE: Riyadh and Tehran renewed diplomatic ties.
OTHER: China brokered the agreement in Beijing.
{"claim":"diff","label":"new"}

SOURCE: A politician supported weakening bank regulations.
OTHER: A senator blamed weakened regulations
for recent bank failures.
{"claim":"diff","label":"new"}

SOURCE: Congress increased the threshold for strict
supervision of large banks.
OTHER: Congress set the new threshold
at $250 billion in assets.
{"claim":"same","label":"fusion"}

SOURCE: Riyadh and Tehran renewed diplomatic ties.
OTHER: Nonalignment was common during the Cold War.
{"claim":"diff","label":"delete"}

SOURCE: Riyadh and Tehran renewed diplomatic ties.
OTHER: HOST: We have to leave it there.
{"claim":"junk","label":"delete"}

SOURCE: Riyadh and Tehran renewed diplomatic ties.
OTHER: Do you think that was the right decision?
{"claim":"junk","label":"delete"}

Return only the JSON object.
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
    left = re.sub(r"\s+", " ", source.get("leading", "").strip().casefold())

    right = re.sub(r"\s+", " ", other.get("leading", "").strip().casefold())

    return bool(left) and left == right


SPEAKER_TAG = re.compile(r"^[A-Z][A-Za-z .]{0,30}:\s*")

JUNK_PATTERNS = [
    r"^(thank you|thanks|welcome|okay|all right|right)\W*$",
    r"^(good morning|good evening|goodbye)\W*$",
    r"^(advertisement|also read|newsletter)\b",
    r"privacy policy|recaptcha|copyright",
    r"skip past newsletter|transcript provided by",
]

def junk_lead(window: dict) -> bool:
    raw = (window.get("leading") or "").strip()

    if not raw:
        return True

    text = SPEAKER_TAG.sub("", raw).strip()

    if not text:
        return True

    return any(re.search(pattern, text, re.I) for pattern in JUNK_PATTERNS)

def parse_label(raw: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", raw, flags=re.S | re.I).strip()

    data = json.loads(text)

    claim = data.get("claim")
    label = data.get("label")

    valid = {
        "duplicate": ("same",),
        "fusion": ("same",),
        "new": ("diff",),
        "delete": ("diff", "junk"),
    }

    if label not in valid:
        raise ValueError(f"Invalid label: {raw}")

    if claim not in valid[label]:
        raise ValueError(
            f"Inconsistent classification: {raw}"
        )

    return label

def classify(source: dict, other: dict, model: str | None = None) -> str:

    if same_lead(source, other):
        return "duplicate"

    if junk_lead(other):
        return "delete"

    prompt = example(source, other)

    raw = generate(prompt,json_mode=True,model=model)

    try:
        return parse_label(raw)

    except (ValueError, json.JSONDecodeError):

        repair_prompt = (prompt+ "\n\nYour previous response was inconsistent ""or invalid:\n"+ raw+ "\nReturn a corrected JSON object ""following the schema exactly.")

        repaired = generate(repair_prompt,json_mode=True,model=model)

        return parse_label(repaired)