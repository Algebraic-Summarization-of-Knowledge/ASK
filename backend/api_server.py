import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from analyze import analyze


HOST = "127.0.0.1"
PORT = 8000
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CORPUS = PROJECT_ROOT / "corpus"


class Handler(BaseHTTPRequestHandler):
    def _write_json(self, payload: dict, status_code: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._write_json({}, status_code=204)

    def do_GET(self) -> None:
        if self.path != "/api/topics":
            self._write_json({"error": "Nieznany endpoint."}, status_code=404)
            return

        topics = []
        if CORPUS.exists():
            for folder in sorted(path for path in CORPUS.iterdir() if path.is_dir()):
                articles = []
                for path in sorted(folder.glob("article_*.json")):
                    data = json.loads(path.read_text(encoding="utf-8"))
                    articles.append({"file": path.name, "title": str(data.get("title") or path.name)})
                if articles:
                    topics.append({"folder": folder.name, "articles": articles})
        self._write_json({"topics": topics})

    def do_POST(self) -> None:
        try:
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            if self.path == "/api/fusion":
                from fusion import fuse

                sentences = [str(item) for item in payload.get("sentences", [])]
                self._write_json({"text": fuse(sentences)})
                return
            if self.path != "/api/convert":
                self._write_json({"error": "Nieznany endpoint."}, status_code=404)
                return

            folder = Path(str(payload.get("folder", ""))).name
            source = Path(str(payload.get("source", ""))).name
            others = [Path(str(name)).name for name in payload.get("others", []) if name]
            self._write_json(analyze(CORPUS / folder, source, others))
        except Exception as exc:
            self._write_json({"error": str(exc)}, status_code=400)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"API server listening on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
