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
INBOUND_SMURF_MIN_COUNT = 4
INBOUND_SMURF_MIN_SENDERS = 3
INBOUND_SMURF_MIN_TOTAL = 1500.0
INBOUND_SMURF_MAX_SINGLE = 1000.0

HIGH_RISK_KEYWORDS = [
    "highriskcountry",
    "sanctionedcountry",
    "xyz",               # synthetic example
    "countryx",
    "hong kong",
    "uae",
    "dubai",
    "china",
    "offshore",
    "foreign wire"
]

def infer_direction_from_details(details: str) -> str:
    d = details.lower()

    inbound_markers = (
        "incoming", "from ", "credit", "deposit", "salary", "payroll"
    )
    outbound_markers = (
        "transfer to", "wire to", "withdrawal", "payment", "sent", "debit"
    )

    if any(k in d for k in inbound_markers):
        return "inbound"
    if any(k in d for k in outbound_markers):
        return "outbound"

    return "unknown"

def _get_amount(tx):
    raw = tx.get("amount") or tx.get("Amount") or ""
    try:
        cleaned = (
            str(raw)
            .replace("$", "")
            .replace(",", "")
            .strip()
        )
        return float(cleaned)
    except Exception:
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
        if _get_type(tx) == "cash" and 9900 < _get_amount(tx) < STRUCTURING_THRESHOLD:
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

    # --- Pattern: INBOUND SMURFING (multi small inbound credits) ---
    inbound_smurf_hits = []

    for day, txs in by_day.items():
        eligible_inbounds = []
        unique_senders = set()

        for t in txs:
            ttype = _get_type(t)
            amount = _get_amount(t)
            details = _get_details(t)

            # Only electronic inbound credits (NO CASH)
            if ttype not in ("p2p", "ach", "wire"):
                continue

            # Must be inbound
            if not ("incoming" in details or "credit" in details or "from" in details):
                continue

            # Smurf-sized only
            if amount >= INBOUND_SMURF_MAX_SINGLE:
                continue

            eligible_inbounds.append(t)
            # sender proxy (synthetic-safe)
            unique_senders.add(details)

        # Minimum transaction count
        if len(eligible_inbounds) < INBOUND_SMURF_MIN_COUNT:
            continue

        # Require distinct senders
        if len(unique_senders) < INBOUND_SMURF_MIN_SENDERS:
            continue

        total_amount = sum(_get_amount(t) for t in eligible_inbounds)
        if total_amount < INBOUND_SMURF_MIN_TOTAL:
            continue

        # ✅ STORE THE HIT
        inbound_smurf_hits.append({
            "date": str(day),
            "transactions": eligible_inbounds,
            "count": len(eligible_inbounds),
            "unique_senders": len(unique_senders),
            "total_amount": total_amount,
        })
    
    # ✅ Append pattern ONCE, AFTER loop
    if inbound_smurf_hits:
        patterns.append({
            "code": "INBOUND_SMURFING",
            "name": "Inbound Smurfing (Funnel Behavior)",
            "description": "Multiple small inbound transfers from distinct senders aggregated to avoid reporting thresholds.",
            "matches": inbound_smurf_hits,
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

    # --- Pattern 5: Crypto-to-bank flow ---
    crypto_hits: List[Dict[str, Any]] = []

    CRYPTO_KEYWORDS = [
        "cryptoexchange",
        "crypto exchange",
        "crypto",
        "coinbase",
        "kraken",
        "binance",
        "kucoin",
        "okx",
        "crypto.com"
    ]

    # Extract all transactions with valid dates
    dated_txs = [(t, _get_date(t)) for t in transactions if _get_date(t)]

    # Identify inbound crypto-related deposits
    crypto_deposits = []
    for tx, d in dated_txs:
        details = _get_details(tx)
        if any(k in details for k in CRYPTO_KEYWORDS):
            crypto_deposits.append((tx, d))

    # Look for outbound flows (wire/P2P) within a 48-hour window
    for crypto_tx, crypto_date in crypto_deposits:
        related_outflows = []

        for t, d in dated_txs:
            if not d:
                continue

            # Time window ±2 days
            if abs((d - crypto_date).days) <= 2:
                # outbound movement
                if _get_type(t) in ("wire", "p2p", "ach") and _get_amount(t) >= CRYPTO_MIN_OUTFLOW:
                    related_outflows.append(t)

        if related_outflows:
            crypto_hits.append({
                "crypto_deposit": crypto_tx,
                "related_outflows": related_outflows,
                "deposit_date": str(crypto_date)
            })

    if crypto_hits:
        patterns.append({
            "code": "CRYPTO_TO_BANK_FLOW",
            "name": "Crypto-to-Bank Flow",
            "description": "Inbound crypto exchange deposits followed by large outbound transfers within 48 hours.",
            "matches": crypto_hits,
        })
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

    # --- Pattern 8: Rapid Outflow (generalized inflow → outflow drain) ---
    rapid_outflow_hits = []

    # define inbound + outbound categories
    inbound_types = {"cash", "ach", "check"}
    outbound_types = {"wire", "ach", "p2p"}

    # collect all tx with dates
    dated = [(tx, _get_date(tx)) for tx in transactions if _get_date(tx)]

    for in_tx, in_date in dated:
        in_type = _get_type(in_tx)
        in_amt = _get_amount(in_tx)

        # inbound criteria
        if in_type not in inbound_types:
            continue
        if in_amt < 5000:
            continue

        # search for matching outbound within 24 hr window
        for out_tx, out_date in dated:
            out_type = _get_type(out_tx)
            out_amt = _get_amount(out_tx)

            if out_type not in outbound_types:
                continue
            if out_amt < 5000:
                continue

            # time window: same day or ±1 day
            if abs((out_date - in_date).days) > 1:
                continue

            # net outflow rule: outbound ≥ 80% of inbound
            if out_amt < in_amt * 0.80:
                continue

            rapid_outflow_hits.append({
                "inbound": in_tx,
                "outbound": out_tx,
                "time_delta_days": (out_date - in_date).days
            })

    if rapid_outflow_hits:
        patterns.append({
            "code": "RAPID_OUTFLOW",
            "name": "Rapid Outflow (Funds Drained After Inbound)",
            "description": "Inbound funds followed by large outbound movement within 24 hours, meeting 80% outflow test.",
            "matches": rapid_outflow_hits,
        })
        risk_score += 4

    # --- Pattern 9: LAYERING_ACTIVITY ---
    layering_hits = []

    SALARY_KEYWORDS = {"salary", "payroll"}
    CRYPTO_KEYWORDS = {"crypto", "exchange", "binance", "coinbase", "kraken"}

    SALARY_MAX = 5000          # salary-sized upper bound
    MIN_LARGE_TX = 6000        # meaningful laundering threshold
    WINDOW_DAYS = 7
    MIN_CHANNELS = 3
    # ⛔ removed salary/payroll — those are used as camouflage in AML

    # prepare dated transactions WITH direction
    dated = [
        (
            tx,
            _get_date(tx),
            _get_amount(tx),
            _get_type(tx),
            _get_details(tx),
        )
        for tx in transactions
        if _get_date(tx) is not None
    ]
    
    for start_tx, start_date, start_amt, start_type, start_details in dated:
        print("Evaluating tx for layering:",start_tx, start_amt)
        # ignore salary-sized anchors
        if start_amt <= SALARY_MAX and any(k in start_details for k in SALARY_KEYWORDS):
            continue

        window_end = start_date + timedelta(days=WINDOW_DAYS)

        window = [
            (tx, d, amt, ttype, details)
            for tx, d, amt, ttype, details in dated
            if start_date <= d <= window_end
        ]

        if len(window) < 4:
            continue

        channels_used = set()
        total_movement = 0.0
        outbound_count = 0

        for tx, d, amt, ttype, details in window:
            direction = infer_direction_from_details(details)
            # register channel
            channels_used.add(ttype)

            # crypto is always suspicious movement
            if any(k in details for k in CRYPTO_KEYWORDS):
                total_movement += amt
                outbound_count += 1
                continue

            if direction == "outbound":
                total_movement += amt
                outbound_count += 1

        if len(channels_used) < MIN_CHANNELS:
            continue

        if total_movement < MIN_LARGE_TX:
            continue
        
        layering_hits.append({
        "window_start": str(start_date),
        "window_end": str(window_end),
        "channels_used": list(channels_used),
        "channel_count": len(channels_used),
        "total_movement": total_movement,
        "transactions": [t[0] for t in window],
        })
        
    if layering_hits:
        patterns.append({
                "code": "LAYERING_ACTIVITY",
                "name": "Layering Activity",
                "description": (
                "Rapid redistribution of inbound funds across multiple outbound "
                "transactions within a short time window, inconsistent with normal usage."
                ),
                "matches": layering_hits,
        })
        risk_score += 6


    # --- Pattern: FUNNELING_ACTIVITY (aggregation → single exit) ---
    funneling_hits = []

    WINDOW_DAYS = 7
    MIN_INBOUND_TX = 4
    MIN_TOTAL_INBOUND = 10000
    CONSOLIDATION_RATIO = 0.80

    # group by date for rolling windows
    dated = [(tx, _get_date(tx)) for tx in transactions if _get_date(tx)]

    for anchor_tx, anchor_date in dated:
        window_start = anchor_date
        window_end = anchor_date + timedelta(days=WINDOW_DAYS)

        inbound = []
        inbound_senders = set()

        outbound = []
        outbound_destinations = defaultdict(float)

        for tx, tx_date in dated:
            if not (window_start <= tx_date <= window_end):
                continue

            ttype = _get_type(tx)
            details = _get_details(tx)
            amount = _get_amount(tx)

            # inbound detection
            if ttype in ("p2p", "ach", "wire") and (
                "incoming" in details or "from" in details or "credit" in details
            ):
                inbound.append(tx)
                inbound_senders.add(details)  # synthetic sender proxy

            # outbound detection
            if ttype in ("wire", "p2p") and amount > 0:
                outbound.append(tx)
                outbound_destinations[details] += amount

        # inbound checks
        if len(inbound) < MIN_INBOUND_TX:
            continue

        inbound_total = sum(_get_amount(t) for t in inbound)
        if inbound_total < MIN_TOTAL_INBOUND:
            continue

        # require multiple distinct senders
        if len(inbound_senders) < MIN_INBOUND_TX:
            continue

        # outbound consolidation check
        if not outbound:
            continue

        max_single_destination = max(outbound_destinations.values())
        if max_single_destination < inbound_total * CONSOLIDATION_RATIO:
            continue

        funneling_hits.append({
            "window_start": str(window_start),
            "window_end": str(window_end),
            "inbound_count": len(inbound),
            "inbound_total": inbound_total,
            "outbound_consolidated_amount": max_single_destination,
            "inbound_transactions": inbound,
            "outbound_transactions": outbound,
        })

    # append pattern once
    if funneling_hits:
        patterns.append({
            "code": "FUNNELING_ACTIVITY",
            "name": "Funneling Activity",
            "description": "Multiple inbound credits from distinct sources aggregated and consolidated to a single outbound destination.",
            "matches": funneling_hits,
        })
        risk_score += 5

    if risk_score <= 0:
        risk_score = 1
    elif risk_score > 10:
        risk_score = 10

    return patterns, risk_score