# app/parser.py

from pathlib import Path
import csv
import pdfplumber
import re

DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

def extract_transactions(file_path: str):
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".csv":
        return _extract_from_csv(path)
    elif ext in [".xlsx", ".xls"]:
        return _extract_from_excel(path)
    elif ext == ".pdf":
        return _extract_from_pdf(path)
    else:
        # fallback / no-op
        return []


def _extract_from_csv(path: Path):
    txs = []
    with path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            txs.append({
                "Date": row.get("Date") or row.get("date"),
                "amount": row.get("amount") or row.get("Amount"),
                "Type": row.get("Type") or row.get("type"),
                "Details": row.get("Details") or row.get("description") or "",
            })
    return txs


def _extract_from_excel(path: Path):
    # if you already have this, keep your existing implementation
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active

    headers = [str(c.value).strip() if c.value else "" for c in ws[1]]
    txs = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        row_dict = {headers[i]: row[i] for i in range(len(headers))}
        txs.append({
            "Date": row_dict.get("Date") or row_dict.get("date"),
            "amount": row_dict.get("amount") or row_dict.get("Amount"),
            "Type": row_dict.get("Type") or row_dict.get("type"),
            "Details": row_dict.get("Details") or row_dict.get("description") or "",
        })
    return txs


def _extract_from_pdf(path: Path):
    """
    Parse PDFs where each transaction row looks like:
    2025-03-09 23510 ACH Outgoing transfer
    (like Mixed_100_Synthetic_Cases.pdf)
    """
    txs = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                # skip headings like "Case 1", "Expected Patterns", etc.
                if not line:
                    continue
                if not DATE_RE.match(line[:10]):
                    continue

                parts = line.split()
                if len(parts) < 4:
                    continue

                date_str = parts[0]
                amount_str = parts[1]
                type_str = parts[2]
                details = " ".join(parts[3:])

                txs.append({
                    "Date": date_str,
                    "amount": amount_str,
                    "Type": type_str,
                    "Details": details,
                })
    return txs
