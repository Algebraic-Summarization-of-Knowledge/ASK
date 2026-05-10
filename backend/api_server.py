import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

from automatiom_without_llm import analyze_texts


HOST = "127.0.0.1"
PORT = 8000
OUTPUT_FILE = (
    Path(__file__).resolve().parent.parent
    / "corpus"
    / "russian_invasion_on_ukraine_24_02_2022"
    / "automated_without_llm.json"
)


def _save_result_to_file(result: Dict[str, Any]) -> None:
    OUTPUT_FILE.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


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
        if self.path != "/api/analyze-without-llm":
            self._write_json({"error": "Nieznany endpoint."}, status_code=404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8"))

            result = analyze_texts(
                text_a=payload.get("sourceA", ""),
                text_b=payload.get("sourceB", ""),
                strong_match_threshold=float(payload.get("threshold", 0.58)),
                conflict_min_similarity=float(payload.get("conflictThreshold", 0.35)),
            )
            _save_result_to_file(result)

            self._write_json(
                {
                    "result": result,
                    "savedResult": result,
                    "savedPath": str(OUTPUT_FILE),
                    "parameters": {
                        "threshold": float(payload.get("threshold", 0.58)),
                        "conflictThreshold": float(payload.get("conflictThreshold", 0.35)),
                    },
                }
            )
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
