import argparse
import importlib
import json
import os
import re
import sys
import warnings
from pathlib import Path
from typing import Any, Dict, Iterable, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent


def _resolve_path(path_value: str, must_exist: bool) -> Path:
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


def _read_json(path: Path) -> Dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        relaxed = _parse_relaxed_article_json(raw)
        if "text" not in relaxed:
            raise
        return relaxed


def _parse_relaxed_article_json(raw: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {}

    for key in ("title", "publishedAt", "url", "source"):
        match = re.search(rf'"{key}"\s*:\s*"([^\n\r]*)"', raw)
        if match:
            result[key] = match.group(1)

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


def _read_dotenv(dotenv_path: Path) -> Dict[str, str]:
    env_vars: Dict[str, str] = {}
    if not dotenv_path.exists():
        return env_vars

    for line in dotenv_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env_vars[key.strip()] = value.strip().strip('"').strip("'")

    return env_vars


def _resolve_api_key() -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        return api_key

    for dotenv_path in (Path.cwd() / ".env", PROJECT_ROOT / ".env", SCRIPT_DIR / ".env"):
        dotenv_values = _read_dotenv(dotenv_path)
        api_key = dotenv_values.get("GEMINI_API_KEY") or dotenv_values.get("GOOGLE_API_KEY")
        if api_key:
            return api_key

    raise EnvironmentError(
        "Brak klucza API. Ustaw GEMINI_API_KEY albo GOOGLE_API_KEY w środowisku "
        "lub wpisz go do lokalnego pliku .env."
    )

def _strip_model_prefix(model_name: str) -> str:
    if model_name.startswith("models/"):
        return model_name.split("/", 1)[1]
    return model_name


def _pick_preferred_model(available_models: Iterable[str], requested_model: str) -> Optional[str]:
    available_list = list(available_models)
    if not available_list:
        return None

    normalized_map = {_strip_model_prefix(model): model for model in available_list}
    requested_plain = _strip_model_prefix(requested_model)
    if requested_plain in normalized_map:
        return normalized_map[requested_plain]

    preferred_order = [
        requested_plain,
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-pro-latest",
    ]
    for candidate in preferred_order:
        if candidate in normalized_map:
            return normalized_map[candidate]

    return available_list[0]


def _list_legacy_generate_models(legacy_genai: Any) -> list[str]:
    return [
        model.name
        for model in legacy_genai.list_models()
        if "generateContent" in getattr(model, "supported_generation_methods", [])
    ]


def _is_unavailable_to_new_users_error(exc: Exception) -> bool:
    return exc.__class__.__name__ == "NotFound" and "no longer available to new users" in str(exc).lower()


def _raise_friendly_gemini_error(exc: Exception, model_name: str) -> None:
    exc_name = exc.__class__.__name__

    if exc_name == "ResourceExhausted":
        raise RuntimeError(
            "Gemini API zwróciło 429 (quota exceeded). Klucz działa, ale konto/projekt nie ma obecnie dostępnego limitu "
            f"dla modelu '{model_name}'. Sprawdź billing i limity w Google AI Studio / Gemini API."
        ) from exc

    if exc_name == "NotFound":
        raise RuntimeError(
            f"Model '{model_name}' nie jest dostępny w aktualnym SDK/API. Uruchom ze wspieranym modelem, np. --model gemini-2.5-flash."
        ) from exc

    raise exc


def _generate_content_rest(model_name: str, api_key: str, prompt: str) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ]
    }
    request = urllib_request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=120) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        try:
            error_payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            error_payload = {}
        error_message = error_payload.get("error", {}).get("message") or str(exc)
        if exc.code == 429:
            raise RuntimeError(
                f"Gemini API zwróciło 429 (quota exceeded) dla modelu '{model_name}'. Sprawdź billing i limity w Google AI Studio / Gemini API."
            ) from exc
        if exc.code == 404:
            raise RuntimeError(
                f"Model '{model_name}' nie jest dostępny w aktualnym API. Uruchom ze wspieranym modelem, np. --model gemini-2.5-flash."
            ) from exc
        raise RuntimeError(error_message) from exc

    try:
        candidates = response_payload["candidates"]
        parts = candidates[0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts)
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Pusty response z modelu.") from exc

    if not text:
        raise RuntimeError("Pusty response z modelu.")
    return text


def _generate_content(model_name: str, api_key: str, prompt: str) -> str:
    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        try:
            response = client.models.generate_content(model=model_name, contents=prompt)
        except Exception as exc:
            _raise_friendly_gemini_error(exc, model_name)
        if not getattr(response, "text", ""):
            raise RuntimeError("Pusty response z modelu.")
        return response.text
    except ImportError:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", FutureWarning)
                legacy_genai = importlib.import_module("google.generativeai")
        except ImportError as exc:
            return _generate_content_rest(model_name, api_key, prompt)

        legacy_genai.configure(api_key=api_key)
        available_models = _list_legacy_generate_models(legacy_genai)
        legacy_model_name = _pick_preferred_model(available_models, model_name)
        if not legacy_model_name:
            raise RuntimeError("Nie udało się pobrać listy modeli obsługujących generateContent.")

        fallback_candidates = [
            candidate
            for candidate in [
                legacy_model_name,
                _pick_preferred_model(available_models, "gemini-2.5-flash"),
                _pick_preferred_model(available_models, "gemini-flash-latest"),
                _pick_preferred_model(available_models, "gemini-2.5-flash-lite"),
            ]
            if candidate
        ]

        seen_candidates = set()
        ordered_candidates = []
        for candidate in fallback_candidates:
            if candidate in seen_candidates:
                continue
            seen_candidates.add(candidate)
            ordered_candidates.append(candidate)

        last_error: Optional[Exception] = None
        for candidate in ordered_candidates:
            model = legacy_genai.GenerativeModel(candidate)
            try:
                response = model.generate_content(prompt)
                if not getattr(response, "text", ""):
                    raise RuntimeError("Pusty response z modelu.")
                return response.text
            except Exception as exc:
                last_error = exc
                if _is_unavailable_to_new_users_error(exc):
                    continue
                _raise_friendly_gemini_error(exc, candidate)

        if last_error is not None:
            _raise_friendly_gemini_error(last_error, legacy_model_name)
        raise RuntimeError("Nie udało się wygenerować odpowiedzi z Gemini.")


def _extract_json_object(raw_text: str) -> Dict[str, Any]:
    cleaned = raw_text.strip()

    # model czasem zwraca JSON w bloku kodu markdown, wiec usuwamy ewentualne znaczniki ```json ... ``` lub ``` ... ```
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned)
        cleaned = re.sub(r"\\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # fallback: wyciagniecie pierwszego poprawnego obiektu JSON z tekstu.
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            raise ValueError("Model response does not contain valid JSON object.")
        return json.loads(match.group(0))


def _build_prompt(
    instructions: Dict[str, Any],
    source_a_name: str,
    source_a_text: str,
    source_b_name: str,
    source_b_text: str,
) -> str:
    instructions_text = json.dumps(instructions, ensure_ascii=False, indent=2)

    return (
        "Wykonaj analizę porównawczą dwóch artykułów zgodnie z instrukcjami. "
        "Odpowiedz WYŁĄCZNIE poprawnym JSON-em bez żadnego dodatkowego tekstu.\n\n"
        "=== INSTRUKCJE ===\n"
        f"{instructions_text}\n\n"
        "=== DANE WEJŚCIOWE ===\n"
        f"Źródło A ({source_a_name}):\n{source_a_text}\n\n"
        f"Źródło B ({source_b_name}):\n{source_b_text}\n\n"
        "=== WYMAGANIA FORMATU WYNIKU ===\n"
        "1) Zwróć dokładnie strukturę kluczy jak w 'schemat_wynikowy_json' z instrukcji.\n"
        "2) W sekcji 'Informacje powielające się' użyj kluczy dokładnie: 'BBC' i 'AlJazeera'.\n"
        "3) W sekcji różnic zachowaj dwa klucze list: 'Różnica (BBC \\ Al Jazeera)' oraz 'Różnica (AlJaazera \\ BBC)'.\n"
        "4) W sekcji konfliktów każdy element ma pola: 'temat', 'BBC', 'AL JAZEERA', 'explanation'.\n"
        "5) Cytaty mają być 1:1 z tekstów wejściowych.\n"
    )


def compare_articles(
    instructions_path: Path,
    source_a_path: Path,
    source_b_path: Path,
    output_path: Path,
    model_name: str,
) -> None:
    api_key = _resolve_api_key()

    instructions = _read_json(instructions_path)
    source_a = _read_json(source_a_path)
    source_b = _read_json(source_b_path)

    source_a_name = str(source_a.get("source", "Źródło A"))
    source_b_name = str(source_b.get("source", "Źródło B"))
    source_a_text = str(source_a.get("text", "")).strip()
    source_b_text = str(source_b.get("text", "")).strip()

    if not source_a_text or not source_b_text:
        raise ValueError("Brak pola 'text' w jednym z plików źródłowych.")

    prompt = _build_prompt(
        instructions=instructions,
        source_a_name=source_a_name,
        source_a_text=source_a_text,
        source_b_name=source_b_name,
        source_b_text=source_b_text,
    )

    result = _extract_json_object(_generate_content(model_name, api_key, prompt))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


def _iter_article_jobs(corpus_dir: Path) -> Iterable[tuple[Path, Path, Path]]:
    for topic_dir in sorted(path for path in corpus_dir.iterdir() if path.is_dir()):
        article_paths = sorted(
            path
            for path in topic_dir.iterdir()
            if path.is_file() and path.name.startswith("article_") and path.suffix == ".json"
        )
        if len(article_paths) < 2:
            continue

        # Jedna analiza per folder: bierzemy pierwsze dwa pliki article_*.json i zapisujemy do automated.json.
        source_a_path, source_b_path = article_paths[:2]
        yield source_a_path, source_b_path, topic_dir / "automated.json"


def compare_corpus(
    instructions_path: Path,
    corpus_dir: Path,
    model_name: str,
) -> int:
    processed_count = 0

    for source_a_path, source_b_path, output_path in _iter_article_jobs(corpus_dir):
        compare_articles(
            instructions_path=instructions_path,
            source_a_path=source_a_path,
            source_b_path=source_b_path,
            output_path=output_path,
            model_name=model_name,
        )
        processed_count += 1
        print(f"Zapisano wynik do: {output_path}")

    return processed_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automatyczne porównanie artykułów i zapis wyniku do JSON."
    )
    parser.add_argument(
        "--instructions",
        default="instructions.json",
        help="Ścieżka do pliku instrukcji JSON.",
    )
    parser.add_argument(
        "--corpus-dir",
        default="corpus",
        help="Katalog z podfolderami tematów i plikami article_*.json.",
    )
    parser.add_argument(
        "--source-a",
        default=None,
        help="Ścieżka do źródła A. Podaj razem z --source-b, aby uruchomić pojedyncze porównanie.",
    )
    parser.add_argument(
        "--source-b",
        default=None,
        help="Ścieżka do źródła B. Podaj razem z --source-a, aby uruchomić pojedyncze porównanie.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Ścieżka pliku wynikowego JSON dla trybu pojedynczej pary.",
    )
    parser.add_argument(
        "--model",
        default="gemini-2.5-flash",
        help="Nazwa modelu Gemini.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        instructions_path = _resolve_path(args.instructions, must_exist=True)

        if bool(args.source_a) != bool(args.source_b):
            raise ValueError("Podaj jednocześnie --source-a i --source-b albo pomiń oba parametry.")

        if args.source_a and args.source_b:
            source_a_path = _resolve_path(args.source_a, must_exist=True)
            source_b_path = _resolve_path(args.source_b, must_exist=True)
            output_path = (
                _resolve_path(args.output, must_exist=False)
                if args.output
                else source_a_path.parent / "automated.json"
            )

            compare_articles(
                instructions_path=instructions_path,
                source_a_path=source_a_path,
                source_b_path=source_b_path,
                output_path=output_path,
                model_name=args.model,
            )
            print(f"Zapisano wynik do: {output_path}")
        else:
            corpus_dir = _resolve_path(args.corpus_dir, must_exist=True)
            processed_count = compare_corpus(
                instructions_path=instructions_path,
                corpus_dir=corpus_dir,
                model_name=args.model,
            )
            if processed_count == 0:
                print("Nie znaleziono żadnych par plików article_*.json do porównania.")
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)