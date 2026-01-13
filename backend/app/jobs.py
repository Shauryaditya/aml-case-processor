# app/jobs.py

from .parser import extract_transactions
from .patterns import run_patterns
from .llm_client import generate_sar
from .pdf_generator import make_pdf
from .job_store import JOB_STORE

HIGH_RISK_PATTERNS = {
    "STRUCTURING_NEAR_THRESHOLD_CASH",
    "ATM_STRUCTURING_WITHDRAWALS",
    "INBOUND_SMURFING",
    "SMURFING_P2P_INBOUND",
    "P2P_MULTIPLE_TRANSFERS_SAME_DAY",
    "CRYPTO_TO_BANK_FLOW",
    "RAPID_OUTFLOW",
    "RAPID_CASH_TO_WIRE",
    "HIGH_RISK_JURISDICTION_WIRE",
}

SAR_DRIVER_PRIORITY = [
    "FUNNELING_ACTIVITY",          # Mule / aggregation accounts (highest severity)
    "LAYERING_ACTIVITY",           # Obfuscation of funds
    "INBOUND_SMURFING",            # Structured aggregation
    "CRYPTO_TO_BANK_FLOW",         # High-risk channel abuse
    "RAPID_OUTFLOW",               # Funds drain
    "RAPID_CASH_TO_WIRE",
    "STRUCTURING_NEAR_THRESHOLD_CASH",
    "ATM_STRUCTURING_WITHDRAWALS",
    "P2P_MULTIPLE_TRANSFERS_SAME_DAY",  # LOW – supporting only
]

SUPPORTING_INDICATORS_BY_DRIVER = {
    "LAYERING_ACTIVITY": [
        "RAPID_OUTFLOW",
        "MULTIPLE_TRANSACTION_CHANNELS",
        "RAPID_SEQUENCE_OF_TRANSFERS",
    ],
    "FUNNELING_ACTIVITY": [
        "MULTIPLE_INBOUND_SOURCES",
        "AGGREGATION_OF_FUNDS",
        "SINGLE_EXIT_DESTINATION",
    ],
    "INBOUND_SMURFING": [
        "MULTIPLE_SMALL_INBOUND_TRANSFERS",
        "DISTINCT_SENDERS",
    ],
}

def compute_supporting_indicators(patterns, main_driver):
    pattern_codes = {p["code"] for p in patterns}

    # 1. Explicit supporting patterns (if present)
    supporting = [
        code for code in pattern_codes
        if code != main_driver
    ]

    # 2. Implicit indicators inferred from main driver
    inferred = SUPPORTING_INDICATORS_BY_DRIVER.get(main_driver, [])

    # Merge + dedupe
    return sorted(set(supporting + inferred))


def compute_case_summary(patterns, risk_band, final_recommendation):
    main_driver = compute_main_sar_driver(patterns)
    supporting = compute_supporting_indicators(patterns, main_driver)

    return {
        "risk_band": risk_band,
        "main_driver": main_driver,
        "supporting_indicators": supporting,
        "recommendation": final_recommendation,
    }

def compute_main_sar_driver(patterns):
    pattern_codes = [p["code"] for p in patterns]

    for code in SAR_DRIVER_PRIORITY:
        if code in pattern_codes:
            return code

    return None

def should_recommend_no_sar(patterns, risk_score: int) -> bool:
    pattern_codes = {p["code"] for p in patterns}

    # If any major SAR driver exists → No SAR NOT allowed
    if pattern_codes & HIGH_RISK_PATTERNS:
        return False

    # Risk must be truly low
    if risk_score > 2:
        return False

    return True

def compute_risk_band(score: int) -> str:
    if score <= 2:
        return "Low"
    elif score <= 6:
        return "Medium"
    else:
        return "High"


def compute_final_recommendation(patterns, risk_score: int) -> str:
    if should_recommend_no_sar(patterns, risk_score):
        return "No SAR"

    if risk_score >= 7:
        return "SAR"

    return "Review"



def process_uploaded_file(job_id: str):
    JOB_STORE[job_id]["status"] = "parsing"
    file_path = JOB_STORE[job_id]["file"]

    print("JOB STATUS UPDATE:", JOB_STORE[job_id]["status"])
    try:
        # 1) Parse transactions
        transactions = extract_transactions(file_path)

        print(f"Parsed {len(transactions)} transactions")
        for i, tx in enumerate(transactions[:5]):
            print(f"TX {i}: {tx['Date']} | {tx['direction']} | {tx['Type']} | {tx['amount']} | {tx['Details']}")

        # 2) Run rules / patterns
        JOB_STORE[job_id]["status"] = "rules"
        patterns, risk_score = run_patterns(transactions)

        # 3) Compute risk band + recommendation
        risk_band = compute_risk_band(risk_score)
        final_recommendation = compute_final_recommendation(patterns, risk_score)

        case_summary = compute_case_summary(
        patterns,
        risk_band,
        final_recommendation
        )

        # 4) Generate SAR narrative via LLM
        JOB_STORE[job_id]["status"] = "llm"
        print("Entering LLM stage")
        sar_text = generate_sar(
                          transactions,
                          patterns,
                          risk_score=risk_score,
                          risk_band=risk_band,
                    )
        print("LLM completed")
        # 5) Generate PDF from SAR narrative
        JOB_STORE[job_id]["status"] = "pdf"
        pdf_path = make_pdf(job_id, sar_text)

        # 6) Save final result
        JOB_STORE[job_id]["status"] = "done"
        JOB_STORE[job_id]["result"] = {
            "transactions": transactions[:100],
            "patterns": patterns,
            "risk_score": risk_score,
            "risk_band": risk_band,
            "final_recommendation": final_recommendation,
            "case_summary": case_summary,
            "sar_text": sar_text,
            }
        JOB_STORE[job_id]["pdf"] = pdf_path

    except Exception as e:
        JOB_STORE[job_id]["status"] = "error"
        JOB_STORE[job_id]["error"] = str(e)
