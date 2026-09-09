import json
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List

from assign_windows import assign_windows_to_source
from context_windows import make_context_windows, sentences_from_json
from embeddings import embed_windows


HOST = "127.0.0.1"
PORT = 8000
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = (
    PROJECT_ROOT
    / "corpus"
    / "russian_invasion_on_ukraine_24_02_2022"
    / "automated_without_llm.json"
)


def resolve_path(path_value: str, must_exist: bool) -> Path:
    candidate = Path(path_value)
    if candidate.is_absolute():
        return candidate

    candidates = [
        Path.cwd() / candidate,
        Path(__file__).resolve().parent / candidate,
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


def _windows_from_json(json_path: Path) -> List[dict]:
    sentences = sentences_from_json(json_path)
    windows = make_context_windows(sentences)
    return embed_windows(windows)


def _windows_from_text(text: str) -> List[dict]:
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as file:
        json.dump({"text": text}, file, ensure_ascii=False)
        temp_path = Path(file.name)

    try:
        return _windows_from_json(temp_path)
    finally:
        temp_path.unlink(missing_ok=True)


def _save_result_to_path(result: Any, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def compare_corpus_without_llm(corpus_dir: Path) -> List[Path]:
    saved_paths: List[Path] = []

    for topic_dir in sorted(path for path in corpus_dir.iterdir() if path.is_dir()):
        article_paths = sorted(
            path
            for path in topic_dir.iterdir()
            if path.is_file() and path.name.startswith("article_") and path.suffix == ".json"
        )
        if len(article_paths) < 2:
            continue

        source_windows = _windows_from_json(article_paths[0])
        other_articles = [_windows_from_json(path) for path in article_paths[1:]]
        result = assign_windows_to_source(source_windows, other_articles)

        output_path = topic_dir / "automated_without_llm.json"
        _save_result_to_path(result, output_path)
        saved_paths.append(output_path)

    return saved_paths


class AnalyzeHandler(BaseHTTPRequestHandler):
    def _write_json(self, payload: Dict[str, Any], status_code: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()

    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8"))

            if self.path == "/api/analyze-without-llm":
                source_windows = _windows_from_text(str(payload.get("sourceA", "")))
                other_windows = _windows_from_text(str(payload.get("sourceB", "")))
                result = assign_windows_to_source(source_windows, [other_windows])

                output_path_raw = payload.get("outputPath")
                saved_path = OUTPUT_FILE
                if output_path_raw:
                    saved_path = resolve_path(str(output_path_raw), must_exist=False)

                _save_result_to_path(result, saved_path)

                self._write_json(
                    {
                        "result": result,
                        "savedResult": result,
                        "savedPath": str(saved_path),
                    }
                )
                return

            if self.path == "/api/analyze-without-llm-corpus":
                corpus_dir = resolve_path(str(payload.get("corpusDir", "corpus")), must_exist=True)
                saved_paths = compare_corpus_without_llm(corpus_dir)

                self._write_json(
                    {
                        "processedCount": len(saved_paths),
                        "savedPaths": [str(path) for path in saved_paths],
                    }
                )
                return

            self._write_json({"error": "Nieznany endpoint."}, status_code=404)
            return
        except Exception as exc:
            self._write_json({"error": str(exc)}, status_code=400)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), AnalyzeHandler)
    print(f"API server listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
