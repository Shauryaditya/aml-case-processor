import json
import time
from pathlib import Path

import requests

API_BASE = "http://localhost:8000"  # FastAPI base URL

BASE_DIR = Path(__file__).resolve().parent
CASES_DIR = BASE_DIR / "cases"
INPUTS_DIR = BASE_DIR / "inputs"


# -----------------------------
# Load test case definitions
# -----------------------------
def load_cases():
    for case_file in CASES_DIR.glob("*.json"):
        with open(case_file, "r", encoding="utf-8") as f:
            case = json.load(f)
        case["_file_path"] = case_file
        yield case


# -----------------------------
# Upload input file
# -----------------------------
def upload_file(file_path: Path) -> str:
    url = f"{API_BASE}/api/upload"
    with open(file_path, "rb") as f:
        files = {"file": (file_path.name, f, "application/octet-stream")}
        resp = requests.post(url, files=files)

    resp.raise_for_status()
    return resp.json()["job_id"]


# -----------------------------
# Poll job STATUS (not result!)
# -----------------------------
def wait_for_status(job_id: str, timeout_sec: int = 60):
    url = f"{API_BASE}/api/status/{job_id}"
    start = time.time()

    while True:
        resp = requests.get(url)
        resp.raise_for_status()
        data = resp.json()

        status = data.get("status")
        print(f"  Polling status: {status}")

        if status in ("done", "error"):
            return data

        if time.time() - start > timeout_sec:
            raise TimeoutError(f"Job {job_id} did not complete in time.")

        time.sleep(1)


# -----------------------------
# Fetch FINAL result
# -----------------------------
def fetch_result(job_id: str):
    url = f"{API_BASE}/api/result/{job_id}"
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.json()


# -----------------------------
# Risk band helper (fallback)
# -----------------------------
def compute_risk_band(score: int) -> str:
    if score <= 2:
        return "Low"
    elif score <= 6:
        return "Medium"
    else:
        return "High"


# -----------------------------
# Run a single test case
# -----------------------------
def run_case(case: dict):
    case_id = case["id"]
    input_file = case["input_file"]

    expected_patterns = set(case.get("expected_patterns", []))
    expected_risk_band = case.get("expected_risk_band")
    expected_recommendation = case.get("expected_recommendation")

    print(f"\n=== Running test case: {case_id} ===")
    print(f"Description: {case.get('description', '')}")

    file_path = INPUTS_DIR / input_file
    if not file_path.exists():
        print(f"[FAIL] Input file not found: {file_path}")
        return False

    # 1) Upload file
    job_id = upload_file(file_path)
    print(f"  Uploaded, job_id = {job_id}")

    # 2) Wait for job completion
    status_data = wait_for_status(job_id)

    if status_data.get("status") == "error":
        print(f"[FAIL] Backend error: {status_data.get('error')}")
        return False

    # 3) Fetch final result
    result = fetch_result(job_id)

    result_patterns = result.get("patterns", [])
    actual_pattern_codes = {p.get("code") for p in result_patterns if p.get("code")}
    actual_risk_score = int(result.get("risk_score", 0))
    actual_risk_band = result.get("risk_band") or compute_risk_band(actual_risk_score)
    actual_recommendation = result.get("final_recommendation")

    ok = True

    # Pattern check (subset match)
    if not expected_patterns.issubset(actual_pattern_codes):
        print("  [FAIL] Patterns mismatch")
        print(f"    Expected (subset): {sorted(expected_patterns)}")
        print(f"    Actual:            {sorted(actual_pattern_codes)}")
        ok = False
    else:
        print(f"  [OK] Patterns: {sorted(actual_pattern_codes)}")

    # Risk band check
    if expected_risk_band and expected_risk_band != actual_risk_band:
        print(
            f"  [FAIL] Risk band mismatch. "
            f"Expected {expected_risk_band}, got {actual_risk_band}"
        )
        ok = False
    else:
        print(f"  [OK] Risk band: {actual_risk_band}")

    # Recommendation check
    if expected_recommendation and expected_recommendation != actual_recommendation:
        print(
            f"  [FAIL] Recommendation mismatch. "
            f"Expected {expected_recommendation}, got {actual_recommendation}"
        )
        ok = False
    else:
        print(f"  [OK] Recommendation: {actual_recommendation}")

    if ok:
        print(f"[PASS] {case_id}")
    else:
        print(f"[FAIL] {case_id}")

    return ok


# -----------------------------
# Run all test cases
# -----------------------------
def main():
    all_ok = True

    for case in load_cases():
        ok = run_case(case)
        all_ok = all_ok and ok

    print("\n======================================")
    if all_ok:
        print("ALL TESTS PASSED ✅")
    else:
        print("SOME TESTS FAILED ❌")


if __name__ == "__main__":
    main()
