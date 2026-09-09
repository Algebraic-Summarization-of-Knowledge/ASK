from sentence_transformers import SentenceTransformer


_model = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2",
            device="cpu",
            local_files_only=True,
        )
    return _model


def embed_windows(windows: list[dict]) -> list[dict]:
    """Liczy embeddingi zdań w oknach kontekstowych: previous, leading i next."""
    if not windows:
        return []

    model = _get_model()
    previous_vectors = model.encode(
        [window["previous"] or "" for window in windows],
        normalize_embeddings=True,
    )
    leading_vectors = model.encode(
        [window["leading"] for window in windows],
        normalize_embeddings=True,
    )
    next_vectors = model.encode(
        [window["next"] or "" for window in windows],
        normalize_embeddings=True,
    )

    embedded_windows = []
    for index, window in enumerate(windows):
        embedded_windows.append(
            {
                "index": window["index"],
                "previous": window["previous"],
                "leading": window["leading"],
                "next": window["next"],
                "previous_embedding": previous_vectors[index] if window["previous"] is not None else None,
                "leading_embedding": leading_vectors[index],
                "next_embedding": next_vectors[index] if window["next"] is not None else None,
            }
        )

    return embedded_windows
