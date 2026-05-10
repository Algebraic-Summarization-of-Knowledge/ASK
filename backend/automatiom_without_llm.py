import argparse
import json
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Sequence, Set, Tuple


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent


def resolve_path(path_value: str, must_exist: bool) -> Path:
    candidate = Path(path_value)
    if candidate.is_absolute():
        return candidate

    candidates = [
        Path.cwd() / candidate,
        SCRIPT_DIR / candidate,
        PROJECT_ROOT / candidate,
    ]

    if must_exist:
        for resolved in candidates:
            if resolved.exists():
                return resolved
        return candidates[0]

    for resolved in candidates:
        if resolved.parent.exists():
            return resolved
    return candidates[0]


STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "his",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "there",
    "they",
    "this",
    "to",
    "was",
    "were",
    "will",
    "with",
    "would",
    "ukraine",
    "russia",
    "russian",
    "ukrainian",
}

MODAL_MARKERS = {
    "report",
    "reports",
    "reported",
    "alleged",
    "allegedly",
    "claims",
    "claim",
    "claimed",
    "according",
    "says",
    "said",
    "denies",
    "deny",
}

NEGATION_MARKERS = {"not", "no", "never", "denies", "deny", "without"}


@dataclass
class Match:
    a_idx: int
    b_idx: int
    score: float


def _parse_relaxed_article_json(raw: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {}

    for key in ("title", "publishedAt", "url", "source"):
        m = re.search(rf'"{key}"\s*:\s*"([^\n\r]*)"', raw)
        if m:
            result[key] = m.group(1)

    text_key = raw.find('"text"')
    if text_key >= 0:
        colon = raw.find(":", text_key)
        start_quote = raw.find('"', colon + 1)
        end_quote = raw.rfind('"\n}')
        if end_quote == -1:
            end_quote = raw.rfind('"\r\n}')
        if start_quote >= 0 and end_quote > start_quote:
            result["text"] = raw[start_quote + 1 : end_quote]

    return result


def read_json(path: Path) -> Dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        relaxed = _parse_relaxed_article_json(raw)
        if "text" not in relaxed:
            raise
        return relaxed


def split_sentences(text: str) -> List[str]:
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []
    chunks = re.split(r"(?<=[.!?])\s+", text)
    return [c.strip() for c in chunks if c and c.strip()]


def normalize(sentence: str) -> str:
    sentence = sentence.lower()
    sentence = re.sub(r"[^\w\s]", " ", sentence)
    sentence = re.sub(r"\s+", " ", sentence).strip()
    return sentence


def tokens(sentence: str) -> Set[str]:
    parts = re.findall(r"\b\w+\b", sentence.lower())
    return {p for p in parts if p not in STOPWORDS}


def text_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()


def greedy_matches(sentences_a: Sequence[str], sentences_b: Sequence[str], threshold: float) -> List[Match]:
    candidates: List[Match] = []
    for i, a in enumerate(sentences_a):
        for j, b in enumerate(sentences_b):
            score = text_similarity(a, b)
            if score >= threshold:
                candidates.append(Match(a_idx=i, b_idx=j, score=score))

    candidates.sort(key=lambda m: m.score, reverse=True)
    used_a: Set[int] = set()
    used_b: Set[int] = set()
    selected: List[Match] = []

    for m in candidates:
        if m.a_idx in used_a or m.b_idx in used_b:
            continue
        used_a.add(m.a_idx)
        used_b.add(m.b_idx)
        selected.append(m)

    selected.sort(key=lambda m: (m.a_idx, m.b_idx))
    return selected


def has_modal(sentence: str) -> bool:
    t = tokens(sentence)
    return any(marker in t for marker in MODAL_MARKERS)


def has_negation(sentence: str) -> bool:
    t = tokens(sentence)
    return any(marker in t for marker in NEGATION_MARKERS)


def extract_numbers(sentence: str) -> Set[str]:
    return set(re.findall(r"\b\d+(?:,\d+)?\b", sentence))


def topic_from_pair(a: str, b: str) -> str:
    shared = list(tokens(a).intersection(tokens(b)))
    if shared:
        return " / ".join(shared[:4]).title()
    return "Różnice w opisie zdarzenia"


def conflicts_from_pairs(
    sentences_a: Sequence[str],
    sentences_b: Sequence[str],
    pair_candidates: Sequence[Tuple[int, int, float]],
    conflict_min_similarity: float,
) -> List[Dict[str, str]]:
    conflicts: List[Dict[str, str]] = []
    seen: Set[Tuple[int, int]] = set()

    for i, j, sim in pair_candidates:
        if (i, j) in seen or sim < conflict_min_similarity:
            continue
        seen.add((i, j))

        a = sentences_a[i]
        b = sentences_b[j]

        a_nums = extract_numbers(a)
        b_nums = extract_numbers(b)
        numeric_conflict = bool(a_nums and b_nums and a_nums != b_nums)

        modal_conflict = has_modal(a) != has_modal(b)
        negation_conflict = has_negation(a) != has_negation(b)

        if not (numeric_conflict or modal_conflict or negation_conflict):
            continue

        reasons: List[str] = []
        if numeric_conflict:
            reasons.append(f"Rozbieżne liczby: A={sorted(a_nums)} vs B={sorted(b_nums)}")
        if modal_conflict:
            reasons.append("Różna modalność/pewność narracji (doniesienia vs stwierdzenie faktu).")
        if negation_conflict:
            reasons.append("Niespójność negacji (jedno źródło zaprzecza, drugie nie).")

        conflicts.append(
            {
                "temat": topic_from_pair(a, b),
                "BBC": a,
                "AL JAZEERA": b,
                "explanation": " ".join(reasons),
            }
        )

        if len(conflicts) >= 12:
            break

    return conflicts


def build_output(sentences_a: Sequence[str], sentences_b: Sequence[str]) -> Dict[str, Any]:
    return build_output_with_thresholds(
        sentences_a,
        sentences_b,
        strong_match_threshold=0.58,
        conflict_min_similarity=0.35,
    )


def build_output_with_thresholds(
    sentences_a: Sequence[str],
    sentences_b: Sequence[str],
    strong_match_threshold: float,
    conflict_min_similarity: float,
) -> Dict[str, Any]:
    strong_matches = greedy_matches(sentences_a, sentences_b, threshold=strong_match_threshold)

    repeated = [
        {
            "BBC": sentences_a[m.a_idx],
            "AlJazeera": sentences_b[m.b_idx],
        }
        for m in strong_matches
    ]

    matched_a = {m.a_idx for m in strong_matches}
    matched_b = {m.b_idx for m in strong_matches}

    unique_a = [s for i, s in enumerate(sentences_a) if i not in matched_a]
    unique_b = [s for i, s in enumerate(sentences_b) if i not in matched_b]

    diffs_a = [f"Kategoria: {s}" for s in unique_a[:25]]
    diffs_b = [f"Kategoria: {s}" for s in unique_b[:25]]

    # slabsze pary tylko do wykrywania potencjalnych konfliktow, nie do ostatecznego wypisania jako powielenia czy roznice
    pair_candidates: List[Tuple[int, int, float]] = []
    for i, sa in enumerate(sentences_a):
        best_j = -1
        best_score = 0.0
        for j, sb in enumerate(sentences_b):
            score = text_similarity(sa, sb)
            if score > best_score:
                best_score = score
                best_j = j
        if best_j >= 0:
            pair_candidates.append((i, best_j, best_score))

    pair_candidates.sort(key=lambda t: t[2], reverse=True)
    conflicts = conflicts_from_pairs(
        sentences_a,
        sentences_b,
        pair_candidates,
        conflict_min_similarity=conflict_min_similarity,
    )

    return {
        "Informacje powielające się": repeated,
        "Różnice/doprecyzowanie informacji/pojawiające się w A, niepojawiające się w B": {
            "Różnica (BBC \\ Al Jazeera)": diffs_a,
            "Różnica (AlJaazera \\ BBC)": diffs_b,
        },
        "Konflikty/sprzeczne fakty?": conflicts,
    }


def analyze_texts(
    text_a: str,
    text_b: str,
    strong_match_threshold: float = 0.58,
    conflict_min_similarity: float = 0.35,
) -> Dict[str, Any]:
    cleaned_a = str(text_a).strip()
    cleaned_b = str(text_b).strip()

    if not cleaned_a or not cleaned_b:
        raise ValueError("Brak tekstu do analizy.")

    if not 0 <= strong_match_threshold <= 1:
        raise ValueError("strong_match_threshold musi być w zakresie 0-1.")
    if not 0 <= conflict_min_similarity <= 1:
        raise ValueError("conflict_min_similarity musi być w zakresie 0-1.")

    sentences_a = split_sentences(cleaned_a)
    sentences_b = split_sentences(cleaned_b)
    return build_output_with_thresholds(
        sentences_a,
        sentences_b,
        strong_match_threshold=strong_match_threshold,
        conflict_min_similarity=conflict_min_similarity,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Porównanie artykułów bez LLM i zapis JSON w formacie handmade."
    )
    parser.add_argument(
        "--source-a",
        default="corpus/russian_invasion_on_ukraine_24_02_2022/article_bbc.json",
        help="Ścieżka do źródła A (BBC).",
    )
    parser.add_argument(
        "--source-b",
        default="corpus/russian_invasion_on_ukraine_24_02_2022/article_aljazeera.json",
        help="Ścieżka do źródła B (AlJazeera).",
    )
    parser.add_argument(
        "--output",
        default="corpus/russian_invasion_on_ukraine_24_02_2022/automated_without_llm.json",
        help="Ścieżka pliku wynikowego JSON.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.58,
        help="Próg dopasowania silnych par zdań (0-1).",
    )
    parser.add_argument(
        "--conflict-threshold",
        type=float,
        default=0.35,
        help="Minimalne podobieństwo dla kandydatów konfliktów (0-1).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_a = read_json(resolve_path(args.source_a, must_exist=True))
    source_b = read_json(resolve_path(args.source_b, must_exist=True))

    text_a = str(source_a.get("text", "")).strip()
    text_b = str(source_b.get("text", "")).strip()

    if not text_a or not text_b:
        raise ValueError("Brak pola 'text' w jednym z plików źródłowych.")

    result = analyze_texts(
        text_a=text_a,
        text_b=text_b,
        strong_match_threshold=args.threshold,
        conflict_min_similarity=args.conflict_threshold,
    )

    output_path = resolve_path(args.output, must_exist=False)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Zapisano wynik do: {args.output}")


if __name__ == "__main__":
    main()
