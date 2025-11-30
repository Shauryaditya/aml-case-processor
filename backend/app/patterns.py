# app/patterns.py

from collections import defaultdict
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from dateutil.parser import parse as parse_dt

# Thresholds / config – can be tuned later
STRUCTURING_THRESHOLD = 10000.0
P2P_BURST_MIN_COUNT = 2
SMURFING_MIN_COUNT = 4
SMURFING_MIN_TOTAL = 1500.0
CRYPTO_MIN_OUTFLOW = 5000.0
ATM_STRUCT_MIN_AMOUNT = 8000.0
ATM_STRUCT_MAX_AMOUNT = 10000.0
ATM_STRUCT_MIN_COUNT = 3

HIGH_RISK_KEYWORDS = [
    "highriskcountry",
    "sanctionedcountry",
    "xyz",               # synthetic example
    "countryx",          # synthetic example
]


def _get_amount(tx: Dict[str, Any]) -> float:
    raw = tx.get("amount") or tx.get("Amount")
    try:
        return float(raw)
    except (TypeError, ValueError):
        return 0.0


def _get_date(tx: Dict[str, Any]) -> Optional[date]:
    raw = tx.get("date") or tx.get("Date")
    if not raw:
        return None
    try:
        return parse_dt(raw).date()
    except Exception:
        return None


def _get_type(tx: Dict[str, Any]) -> str:
    return (tx.get("Type") or tx.get("type") or "").strip().lower()


def _get_details(tx: Dict[str, Any]) -> str:
    return (tx.get("Details") or tx.get("description") or "").lower()


def run_patterns(transactions: List[Dict[str, Any]]):
    """
    Pattern 1 — Structuring (Near-Threshold Cash)
        IF amount < 10000 AND type == "Cash"

    Pattern 2 — Cash → Wire Same Day
        IF cash.date == wire.date AND wire.amount > 5000

    Pattern 3 — Multiple P2P Transfers (Layering)
        IF type == "P2P" AND count >= 2 on same day
        OR single P2P row with description indicating multiple transfers

    Pattern 4 — Smurfing (Inbound P2P)
        IF many small inbound P2P credits on same day (>= 4 and total >= 1500)

    Pattern 5 — Crypto-to-bank flow
        IF deposit from crypto exchange AND large outbound (wire/P2P) within 1 day

    Pattern 6 — High-risk jurisdiction wire
        IF wire.details mention high-risk keyword

    Pattern 7 — ATM structuring
        IF >= 3 ATM withdrawals between 8,000 and 10,000
    """
    patterns: List[Dict[str, Any]] = []
    risk_score = 0

    # Group by day
    by_day: Dict[date, List[Dict[str, Any]]] = defaultdict(list)
    for tx in transactions:
        d = _get_date(tx)
        if d is not None:
            by_day[d].append(tx)

    # --- Pattern 1: Structuring (Near-Threshold Cash) ---
    structuring_hits: List[Dict[str, Any]] = []
    for tx in transactions:
        if _get_type(tx) == "cash" and _get_amount(tx) < STRUCTURING_THRESHOLD:
            structuring_hits.append(tx)

    if structuring_hits:
        patterns.append({
            "code": "STRUCTURING_NEAR_THRESHOLD_CASH",
            "name": "Structuring (Near-Threshold Cash)",
            "description": "Cash transactions below the 10,000 threshold that may indicate structuring.",
            "matches": structuring_hits,
        })
        risk_score += 3

    # --- Pattern 2: Cash → Wire Same Day ---
    cash_wire_hits: List[Dict[str, Any]] = []
    for day, txs in by_day.items():
        cash_txs = [t for t in txs if _get_type(t) == "cash"]
        wire_txs = [t for t in txs if _get_type(t) == "wire" and _get_amount(t) > 5000]
        if cash_txs and wire_txs:
            cash_wire_hits.append({
                "date": str(day),
                "cash_transactions": cash_txs,
                "wire_transactions": wire_txs,
            })

    if cash_wire_hits:
        patterns.append({
            "code": "RAPID_CASH_TO_WIRE",
            "name": "Rapid Cash-to-Wire (Same Day)",
            "description": "Same-day cash deposits followed by outbound wire transfers over 5,000.",
            "matches": cash_wire_hits,
        })
        risk_score += 4

    # --- Pattern 3: Multiple P2P Transfers (Layering / Burst) ---
    p2p_hits: List[Dict[str, Any]] = []
    for day, txs in by_day.items():
        p2p_txs = [t for t in txs if _get_type(t) == "p2p"]
        count = len(p2p_txs)

        if not p2p_txs:
            continue

        details_list = [_get_details(t) for t in p2p_txs]
        # aggregated rows like "multiple small P2P transfers"
        has_aggregated_row = any(
            ("multiple" in d and "transfer" in d) for d in details_list
        )

        # Normal burst: >= 2 P2P on same day
        # Exception: a single aggregated "multiple transfers" row
        if count >= P2P_BURST_MIN_COUNT or (count == 1 and has_aggregated_row):
            p2p_hits.append({
                "date": str(day),
                "p2p_count": count,
                "transactions": p2p_txs,
            })

    if p2p_hits:
        patterns.append({
            "code": "P2P_MULTIPLE_TRANSFERS_SAME_DAY",
            "name": "P2P Unknown Counterparties (Burst)",
            "description": "Multiple or batch P2P transfers on the same day, suggesting potential layering.",
            "matches": p2p_hits,
        })
        risk_score += 3


    # --- Pattern 4: Smurfing (Inbound P2P from many senders) ---
    smurfing_hits: List[Dict[str, Any]] = []
    for day, txs in by_day.items():
        p2p_inbound = [
            t for t in txs
            if _get_type(t) == "p2p" and "incoming" in _get_details(t)
        ]
        if len(p2p_inbound) >= SMURFING_MIN_COUNT:
            total_inbound = sum(_get_amount(t) for t in p2p_inbound)
            if total_inbound >= SMURFING_MIN_TOTAL:
                smurfing_hits.append({
                    "date": str(day),
                    "p2p_count": len(p2p_inbound),
                    "total_amount": total_inbound,
                    "transactions": p2p_inbound,
                })

    if smurfing_hits:
        patterns.append({
            "code": "SMURFING_P2P_INBOUND",
            "name": "Smurfing via Inbound P2P",
            "description": "Many small inbound P2P credits from multiple sources on the same day.",
            "matches": smurfing_hits,
        })
        risk_score += 4

    # --- Pattern 5: Crypto-to-bank flow ---
    crypto_hits: List[Dict[str, Any]] = []
    dated_txs = [(t, _get_date(t)) for t in transactions if _get_date(t) is not None]
    crypto_deposits = [
        (t, d) for (t, d) in dated_txs
        if "cryptoexchange" in _get_details(t) or "coinbase" in _get_details(t)
    ]

    for crypto_tx, crypto_date in crypto_deposits:
        related_outflows = []
        for t, d in dated_txs:
            if d is None:
                continue
            # +/- 1 day window
            if abs((d - crypto_date).days) <= 1:
                if _get_type(t) in ("wire", "p2p") and _get_amount(t) >= CRYPTO_MIN_OUTFLOW:
                    related_outflows.append(t)
        if related_outflows:
            crypto_hits.append({
                "crypto_deposit": crypto_tx,
                "related_outflows": related_outflows,
            })

    if crypto_hits:
        patterns.append({
            "code": "CRYPTO_TO_BANK_FLOW",
            "name": "Crypto-to-Bank Flow",
            "description": "Deposits from crypto exchanges followed by large outbound transfers.",
            "matches": crypto_hits,
        })
        # Crypto-to-bank flows are inherently high-risk
        risk_score += 7
    # --- Pattern 6: High-risk jurisdiction wires ---
    high_risk_hits: List[Dict[str, Any]] = []
    for tx in transactions:
        if _get_type(tx) == "wire":
            details = _get_details(tx)
            if any(keyword in details for keyword in HIGH_RISK_KEYWORDS):
                high_risk_hits.append(tx)

    if high_risk_hits:
        patterns.append({
            "code": "HIGH_RISK_JURISDICTION_WIRE",
            "name": "High-Risk Jurisdiction Wire",
            "description": "Wire transfers referencing a high-risk or sanctioned jurisdiction.",
            "matches": high_risk_hits,
        })
        # Single high-risk wire should be treated as High
        risk_score += 7

    # --- Pattern 7: ATM structuring ---
    atm_txs = [
        tx for tx in transactions
        if _get_type(tx) == "atm" or "atm withdrawal" in _get_details(tx)
    ]
    atm_struct_hits = [
        tx for tx in atm_txs
        if ATM_STRUCT_MIN_AMOUNT <= _get_amount(tx) < ATM_STRUCT_MAX_AMOUNT
    ]

    if len(atm_struct_hits) >= ATM_STRUCT_MIN_COUNT:
        patterns.append({
            "code": "ATM_STRUCTURING_WITHDRAWALS",
            "name": "ATM Structuring",
            "description": "Repeated ATM withdrawals just below reporting threshold.",
            "matches": atm_struct_hits,
        })
        risk_score += 3

    if risk_score <= 0:
        risk_score = 1
    elif risk_score > 10:
        risk_score = 10

    return patterns, risk_score
