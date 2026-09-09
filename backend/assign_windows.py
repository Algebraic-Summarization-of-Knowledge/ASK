import numpy as np


LEADING_WEIGHT = 0.7
NEIGHBOR_WEIGHT = 0.15


def _cosine(vector_a, vector_b) -> float:
    a = np.asarray(vector_a, dtype=float)
    b = np.asarray(vector_b, dtype=float)
    norms = np.linalg.norm(a) * np.linalg.norm(b)
    if norms == 0:
        return 0.0
    return float(np.dot(a, b) / norms)


def _window_similarity(source_window: dict, other_window: dict) -> float:
    score = LEADING_WEIGHT * _cosine(
        source_window["leading_embedding"],
        other_window["leading_embedding"],
    )

    if source_window["previous_embedding"] is not None and other_window["previous_embedding"] is not None:
        score += NEIGHBOR_WEIGHT * _cosine(
            source_window["previous_embedding"],
            other_window["previous_embedding"],
        )

    if source_window["next_embedding"] is not None and other_window["next_embedding"] is not None:
        score += NEIGHBOR_WEIGHT * _cosine(
            source_window["next_embedding"],
            other_window["next_embedding"],
        )

    return score


def _as_text(window: dict) -> dict:
    return {
        "index": window["index"],
        "previous": window["previous"],
        "leading": window["leading"],
        "next": window["next"],
    }


def assign_windows_to_source(source_windows: list[dict], other_articles: list[list[dict]]) -> list[dict]:
    """Przypisuje każde okno z pozostałych artykułów do najbliższego okna źródłowego (1-NN).

    Wagi podobieństwa: 0.7 dla zdania wiodącego Sn, 0.15 dla Sn-1 i 0.15 dla Sn+1.
    Jedno okno źródłowe może dostać wiele okien z pozostałych artykułów.
    """
    groups = [
        {
            "source": _as_text(source_window),
            "assigned": [],
        }
        for source_window in source_windows
    ]

    if not source_windows:
        return groups

    for article_index, article_windows in enumerate(other_articles):
        for other_window in article_windows:
            best_index = 0
            best_score = -1.0

            for source_index, source_window in enumerate(source_windows):
                score = _window_similarity(source_window, other_window)
                if score > best_score:
                    best_score = score
                    best_index = source_index

            groups[best_index]["assigned"].append(
                {
                    "article_index": article_index,
                    "score": best_score,
                    **_as_text(other_window),
                }
            )

    return groups
