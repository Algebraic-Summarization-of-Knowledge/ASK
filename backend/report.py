from datetime import datetime
from pathlib import Path

from fpdf import FPDF

from judge import LABELS
from llm import MODEL

REPORTS = Path(__file__).resolve().parent.parent / "reports"
COLS = (18, 22, 42, 95, 95)


def _text(value: object) -> str:
    raw = "" if value is None else str(value)
    return raw.replace("—", "-").replace("–", "-").replace("’", "'").replace("“", '"').replace("”", '"').encode(
        "latin-1", "replace"
    ).decode("latin-1")


def _lead(window: object) -> str:
    if isinstance(window, dict):
        return str(window.get("leading") or "")
    return ""


def _stats(pairs: list[dict]) -> list[tuple[str, int, str, str]]:
    rows = []
    for label in LABELS:
        scores = [float(pair["score"]) for pair in pairs if pair.get("label") == label]
        if not scores:
            rows.append((label, 0, "-", "-"))
            continue
        rows.append((label, len(scores), f"{min(scores):.3f}", f"{max(scores):.3f}"))
    return rows


def save_report(
    folder: str, source: str, others: list[str], pairs: list[dict], model: str | None = None
) -> str:
    used = (model or MODEL).strip() or MODEL
    REPORTS.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    name = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}_{used.replace(':', '-')}_{folder[:50]}.pdf"
    path = REPORTS / name.replace("/", "_")

    pdf = FPDF(orientation="L", format="A4")
    pdf.set_auto_page_break(auto=True, margin=10)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, "ASK judge report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    for line in (
        f"date: {stamp}",
        f"model: {used}",
        f"folder: {folder}",
        f"source: {source}",
        f"others: {', '.join(others)}",
        f"pairs: {len(pairs)}",
        "",
    ):
        pdf.cell(0, 6, _text(line), new_x="LMARGIN", new_y="NEXT")

    with pdf.table(col_widths=(40, 25, 30, 30)) as table:
        head = table.row()
        for cell in ("label", "n", "min", "max"):
            head.cell(cell)
        for label, n, low, high in _stats(pairs):
            row = table.row()
            row.cell(label)
            row.cell(str(n))
            row.cell(low)
            row.cell(high)

    pdf.ln(6)
    with pdf.table(col_widths=COLS) as table:
        head = table.row()
        for cell in ("score", "label", "file", "source", "other"):
            head.cell(cell)
        for pair in pairs:
            other = pair.get("other") or {}
            index = other.get("index", "") if isinstance(other, dict) else ""
            row = table.row()
            row.cell(f"{float(pair.get('score') or 0):.3f}")
            row.cell(_text(pair.get("label") or "-"))
            row.cell(_text(f"{pair.get('file', '')} #{index}"))
            row.cell(_text(_lead(pair.get("source"))))
            row.cell(_text(_lead(other)))

    pdf.output(path)
    return str(path)
