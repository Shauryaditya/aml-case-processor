# app/jobs.py

from .parser import extract_transactions
from .patterns import run_patterns
from .llm_client import generate_sar
from .pdf_generator import make_pdf
from .job_store import JOB_STORE


def compute_risk_band(score: int) -> str:
    if score <= 2:
        return "Low"
    elif score <= 6:
        return "Medium"
    else:
        return "High"


def compute_final_recommendation(score: int) -> str:
    band = compute_risk_band(score)
    if band == "High":
        return "SAR"
    elif band == "Medium":
        return "Review"
    else:
        return "No SAR"


def process_uploaded_file(job_id: str):
    JOB_STORE[job_id]["status"] = "parsing"
    file_path = JOB_STORE[job_id]["file"]

    try:
        # 1) Parse transactions
        transactions = extract_transactions(file_path)

        # 2) Run rules / patterns
        JOB_STORE[job_id]["status"] = "rules"
        patterns, risk_score = run_patterns(transactions)

        # 3) Compute risk band + recommendation
        risk_band = compute_risk_band(risk_score)
        final_recommendation = compute_final_recommendation(risk_score)

        # 4) Generate SAR narrative via LLM
        JOB_STORE[job_id]["status"] = "llm"
        sar_text = generate_sar(
                          transactions,
                          patterns,
                          risk_score=risk_score,
                          risk_band=risk_band,
                    )

        # 5) Generate PDF from SAR narrative
        JOB_STORE[job_id]["status"] = "pdf"
        pdf_path = make_pdf(job_id, sar_text)

        # 6) Save final result
        JOB_STORE[job_id]["status"] = "done"
        JOB_STORE[job_id]["result"] = {
            "transactions": transactions[:50],  # sample limit
            "patterns": patterns,
            "risk_score": risk_score,
            "risk_band": risk_band,
            "final_recommendation": final_recommendation,
            "sar_text": sar_text,
        }
        JOB_STORE[job_id]["pdf"] = pdf_path

    except Exception as e:
        JOB_STORE[job_id]["status"] = "error"
        JOB_STORE[job_id]["error"] = str(e)
