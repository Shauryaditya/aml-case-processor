import os
import json
import requests

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


SAR_PROMPT_TEMPLATE = """
You are an experienced AML Investigator.
Your job is to write a concise, regulator-ready SAR narrative using ONLY the information provided.

Use this exact structure:

1. Summary of Activity  
   - 2–3 sentences summarizing the overall pattern of activity and time period.

2. What Happened (Factual Description)  
   - Describe the customer's transactions in neutral, factual language.
   - Focus on the key flows (cash, wires, P2P, ACH, checks, card, crypto, high-risk jurisdictions).
   - Do NOT describe internal systems, alerts, scores, or models.

3. Why It Is Suspicious (Red Flags)  
   - Explicitly name the suspicious activity types based on the detected patterns, such as:
     • Structuring (near-threshold cash activity)
     • Rapid cash-to-wire movement
     • Layering via P2P or multi-channel flows
     • High-risk geography wires
     • Mule / pass-through behavior
     • Crypto-to-bank conversion
     • Altered or fraudulent checks
     • ATM structuring
   - Briefly explain why each pattern increases risk.

4. Transaction Summary (Selected Examples)  
   - List 3 to 8 key transactions as bullet points.
   - Each bullet should have: date, amount, channel, and a short description.
   - Pick the MOST relevant transactions that illustrate the suspicious patterns (e.g., near-threshold cash, same-day cash→wire, P2P bursts, high-risk wires, crypto-related activity, altered checks).
   - Do NOT list every transaction in the dataset.

5. Final Recommendation  
   - End with a single clear sentence:
     • “Based on the above activity and associated red flags, a Suspicious Activity Report is recommended.”
       OR
     • “Based on the above activity and lack of significant red flags, a Suspicious Activity Report is not recommended.”

STRICT RULES:
- Do NOT include headings like “Executive Summary”, “Key Findings”, “Disposition”, “Recommended Next Steps”, or “Law Enforcement Notification”.
- Do NOT include placeholders like “Insert Institution Name Here”.
- Do NOT mention internal systems, alerts, scores, or models.
- Do NOT describe EDD steps, law enforcement referrals, or internal processes.
- Do NOT invent information that is not present in the input.

INPUT DATA:
Transactions:
{transactions}

Detected Patterns:
{patterns}

Risk Information (if provided):
risk_score: {risk_score}
risk_band: {risk_band}
"""

def format_tx_for_sar(tx: dict) -> str:
    date = tx.get("Date", "Unknown date")
    channel = tx.get("Type", "unknown").upper()
    details = tx.get("Details", "no description")

    amount = tx.get("amount")
    direction = tx.get("direction")

    # Normalize amount
    amt = (
        str(amount)
        .replace("$", "")
        .replace(",", "")
        .strip()
        if amount else "0"
    )

    # Direction-aware wording (critical)
    if direction == "inbound":
        flow = "credit"
    elif direction == "outbound":
        flow = "debit"
    else:
        flow = "transaction"

    return f"{date} – {flow} of ${amt} via {channel} – {details}"

def _fallback_sar(transactions, patterns, risk_score=None, risk_band=None):
    """
    Used when LLM is unavailable or returns error.
    Still follows the required 1–5 structure in a simple deterministic way.
    """
    tx_sample = transactions[:5] if transactions else []
    pattern_codes = [p.get("code") for p in patterns or [] if p.get("code")]

    lines = []

    # 1. Summary of Activity
    lines.append("1. Summary of Activity")
    if not transactions:
        lines.append("The account shows limited activity with no transactions available for review.")
    else:
        lines.append(
            "The account shows transaction activity over the observed period, "
            "including cash, electronic transfers, and other channels. "
            "Rule-based monitoring identified potential red flags based on the transaction patterns."
        )
    lines.append("")

    # 2. What Happened (Factual Description)
    lines.append("2. What Happened (Factual Description)")
    if tx_sample:
        lines.append("Selected example transactions include:")
        for tx in tx_sample:
            lines.append(f"- {format_tx_for_sar(tx)}")
    else:
        lines.append("- No transaction-level details are available.")
    lines.append("")

    # 3. Why It Is Suspicious (Red Flags)
    lines.append("3. Why It Is Suspicious (Red Flags)")
    if pattern_codes:
        lines.append("The following rule-based patterns were detected:")
        for code in pattern_codes:
            lines.append(f"- {code}")
    else:
        lines.append(
            "No material red flags were detected based on the rule set applied to this account's activity."
        )
    lines.append("")

    # 4. Transaction Summary (Selected Examples)
    lines.append("4. Transaction Summary (Selected Examples)")
    if tx_sample:
        for tx in tx_sample:
            lines.append(
                f"- {format_tx_for_sar(tx)}"
            )
    else:
        lines.append("- No transactions to summarize.")
    lines.append("")

    # 5. Final Recommendation
    lines.append("5. Final Recommendation")
    # If any patterns present and risk_band is High/Medium, lean SAR; otherwise No SAR
    band = (risk_band or "").lower() if risk_band else ""
    if pattern_codes and band in ("high", "medium"):
        lines.append(
            "Based on the above activity and associated red flags, a Suspicious Activity Report is recommended."
        )
    else:
        lines.append(
            "Based on the above activity and lack of significant red flags, a Suspicious Activity Report is not recommended."
        )

    return "\n".join(lines)


def generate_sar(transactions, patterns, risk_score=None, risk_band=None):
    """
    Calls OpenRouter if possible; if key is missing or HTTP fails,
    returns a deterministic fallback SAR narrative so the backend never breaks.
    """
    # If no key configured, immediately fallback
    if not OPENROUTER_KEY:
        return _fallback_sar(transactions, patterns, risk_score, risk_band)

    tx_for_prompt = transactions[:100] if transactions else []
    formatted_txs = [format_tx_for_sar(tx) for tx in tx_for_prompt]

    prompt = SAR_PROMPT_TEMPLATE.format(
        transactions="\n".join(formatted_txs),
        patterns=json.dumps(patterns or [], indent=2),
        risk_score=risk_score if risk_score is not None else "N/A",
        risk_band=risk_band if risk_band is not None else "N/A",
    )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "model": "deepseek/deepseek-r1-0528:free",  # TODO: set your actual model id
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 800,
    }

    try:
        resp = requests.post(OPENROUTER_URL, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except requests.RequestException:
        # On any network/auth/model error: do NOT kill the job
        return _fallback_sar(transactions, patterns, risk_score, risk_band)
