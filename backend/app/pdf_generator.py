# app/pdf_generator.py

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPORTS_DIR = BASE_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def make_pdf(job_id: str, sar_text: str) -> str:
    """
    Create a simple one- or two-page PDF with the SAR narrative text.
    """
    pdf_path = REPORTS_DIR / f"sar_{job_id}.pdf"

    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    y = height - 50

    # Title
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, "AML Case Summary")
    y -= 30

    # Body text
    c.setFont("Helvetica", 10)

    if sar_text is None:
        sar_text = ""

    for raw_line in str(sar_text).splitlines():
        line = raw_line.strip()
        if not line:
            y -= 12
            continue

        # simple wrapping at ~110 characters
        while len(line) > 110:
            segment = line[:110]
            c.drawString(50, y, segment)
            y -= 12
            line = line[110:]
            if y < 60:
                c.showPage()
                y = height - 50
                c.setFont("Helvetica", 10)

        c.drawString(50, y, line)
        y -= 12

        if y < 60:
            c.showPage()
            y = height - 50
            c.setFont("Helvetica", 10)

    c.save()
    return str(pdf_path)
