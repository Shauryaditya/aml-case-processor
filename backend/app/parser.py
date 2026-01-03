# app/parser.py

from pathlib import Path
import csv
import pdfplumber
import re

DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
KNOWN_CHANNELS = {
    "ach", "wire", "cash", "atm", "card", "p2p", "crypto"
}

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

def infer_direction_from_details(details: str) -> str:
    d = details.lower()

    inbound = (
        "incoming", "from ", "credit", "deposit", "salary", "payroll", "received"
    )
    outbound = (
        "transfer to", "wire to", "withdrawal", "payment", "sent", "debit", "purchase"
    )

    if any(k in d for k in inbound):
        return "inbound"
    if any(k in d for k in outbound):
        return "outbound"

    return "unknown"


def _extract_from_pdf(path: Path):
    """
    Hybrid PDF parser:
    - Uses Debit/Credit if available
    - Falls back to single amount + keyword inference
    """
    txs = []

    money_re = re.compile(r"\$-?[\d,]+\.\d{2}")

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()

                # skip noise
                if not line:
                    continue
                if not DATE_RE.match(line[:10]):
                    continue
                if "Opening Balance" in line or "Closing Balance" in line:
                    continue

                date_str = line[:10]
                amounts = money_re.findall(line)

                debit = credit = balance = None
                direction = "unknown"

                if len(amounts) == 3:
                    debit, credit, balance = amounts
                elif len(amounts) == 2:
                    debit, balance = amounts
                elif len(amounts) == 1:
                    debit = amounts[0]
                else:
                    continue
                # Decide transaction amount + direction
                if credit and credit != "$0.00":
                    amount = credit
                    direction = "inbound"
                elif debit:
                    amount = debit
                    direction = "outbound"
                else:
                    continue


                # isolate text fields
                clean_line = line
                for a in amounts:
                    clean_line = clean_line.replace(a, "")

                tokens = clean_line.split()

                channel = "unknown"
                for t in reversed(tokens):
                    if t.lower() in KNOWN_CHANNELS:
                        channel = t.lower()
                        break

                description = " ".join(
                    t for t in tokens[1:] if t.lower() != channel
                ).lower()
                txs.append({
                    "Date": date_str,
                    "amount": amount,
                    "Type": channel,
                    "Details": description,
                    "direction": direction,
                })

    return txs

