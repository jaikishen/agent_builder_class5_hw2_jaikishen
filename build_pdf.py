"""Render data/skynova_handbook.md to data/skynova_handbook.pdf.

Run once:
    uv add reportlab    (or: pip install reportlab)
    uv run python data/build_pdf.py

The parser handles the markdown subset used in skynova_handbook.md:
H1/H2/H3 headings, paragraphs, bullet lists, GitHub-style tables,
**bold**, *italic*, `code`, and `---` rules.
"""
from __future__ import annotations
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)


def _inline(text: str) -> str:
    """Convert markdown inline syntax to reportlab paragraph markup."""
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    return text


def _make_styles():
    base = getSampleStyleSheet()
    base.add(ParagraphStyle("SkyBody", parent=base["Normal"],
                            fontName="Helvetica", fontSize=10, leading=14, spaceAfter=4))
    base.add(ParagraphStyle("SkyH1", parent=base["Normal"],
                            fontName="Helvetica-Bold", fontSize=20, leading=24,
                            spaceAfter=12, textColor=colors.HexColor("#1f3b73")))
    base.add(ParagraphStyle("SkyH2", parent=base["Normal"],
                            fontName="Helvetica-Bold", fontSize=14, leading=18,
                            spaceBefore=10, spaceAfter=8,
                            textColor=colors.HexColor("#1f3b73")))
    base.add(ParagraphStyle("SkyH3", parent=base["Normal"],
                            fontName="Helvetica-Bold", fontSize=11, leading=14,
                            spaceBefore=6, spaceAfter=4))
    base.add(ParagraphStyle("SkyCell", parent=base["Normal"],
                            fontName="Helvetica", fontSize=9, leading=11))
    base.add(ParagraphStyle("SkyCellHeader", parent=base["Normal"],
                            fontName="Helvetica-Bold", fontSize=9, leading=11,
                            textColor=colors.white))
    return base


def parse_md(md_text: str, styles) -> list:
    flow: list = []
    para: list[str] = []
    bullets: list[str] = []
    table: list[list[str]] = []

    def flush_para():
        nonlocal para
        if para:
            txt = " ".join(p.strip() for p in para).strip()
            if txt:
                flow.append(Paragraph(_inline(txt), styles["SkyBody"]))
                flow.append(Spacer(1, 4))
            para = []

    def flush_bullets():
        nonlocal bullets
        if bullets:
            items = [
                ListItem(Paragraph(_inline(b), styles["SkyBody"]), leftIndent=10)
                for b in bullets
            ]
            flow.append(ListFlowable(items, bulletType="bullet", leftIndent=18,
                                     bulletFontSize=8))
            flow.append(Spacer(1, 6))
            bullets = []

    def flush_table():
        nonlocal table
        if not table:
            return
        header = [Paragraph(_inline(c), styles["SkyCellHeader"]) for c in table[0]]
        body_rows = table[2:] if len(table) > 2 else []
        body = [
            [Paragraph(_inline(c), styles["SkyCell"]) for c in row]
            for row in body_rows
        ]
        t = Table([header] + body, repeatRows=1, hAlign="LEFT")
        t.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0), (-1, 0),  colors.HexColor("#1f3b73")),
            ("GRID",           (0, 0), (-1, -1), 0.25, colors.grey),
            ("VALIGN",         (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",    (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",   (0, 0), (-1, -1), 4),
            ("TOPPADDING",     (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 3),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.HexColor("#f5f7fb"), colors.white]),
        ]))
        flow.append(t)
        flow.append(Spacer(1, 8))
        table = []

    for raw in md_text.splitlines():
        line = raw.rstrip()

        if line.startswith("|") and line.endswith("|"):
            flush_para(); flush_bullets()
            cells = [c.strip() for c in line.strip("|").split("|")]
            table.append(cells)
            continue
        if table:
            flush_table()

        if line.startswith("### "):
            flush_para(); flush_bullets()
            flow.append(Paragraph(_inline(line[4:]), styles["SkyH3"]))
            continue
        if line.startswith("## "):
            flush_para(); flush_bullets()
            flow.append(Paragraph(_inline(line[3:]), styles["SkyH2"]))
            continue
        if line.startswith("# "):
            flush_para(); flush_bullets()
            flow.append(Paragraph(_inline(line[2:]), styles["SkyH1"]))
            continue

        if line.strip() == "---":
            flush_para(); flush_bullets()
            flow.append(Spacer(1, 6))
            continue

        if line.startswith("- "):
            flush_para()
            bullets.append(line[2:])
            continue
        if bullets:
            flush_bullets()

        if line.strip() == "":
            flush_para()
            continue

        para.append(line)

    flush_para(); flush_bullets(); flush_table()
    return flow


def build(md_path: Path, pdf_path: Path) -> None:
    styles = _make_styles()
    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=LETTER,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title="SkyNova Passenger Handbook",
        author="SkyNova Airlines",
    )
    doc.build(parse_md(md_path.read_text(encoding="utf-8"), styles))


if __name__ == "__main__":
    here = Path(__file__).parent
    out = here / "skynova_handbook.pdf"
    build(here / "skynova_handbook.md", out)
    print(f"Wrote {out}")
