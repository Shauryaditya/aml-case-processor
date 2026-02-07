import os
import json
import requests
import logging
from dotenv import load_dotenv
from pathlib import Path

# Explicitly load .env from backend root
base_dir = Path(__file__).resolve().parent.parent
env_path = base_dir / ".env"
load_dotenv(dotenv_path=env_path)

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
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
    # Ensure safe access for Type as it can be None
    channel = (tx.get("Type") or "unknown")
    if channel:
        channel = channel.upper()
    else:
        channel = "UNKNOWN"
        
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
    logging.info("Using fallback SAR generation")
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
        logging.warning("OPENROUTER_KEY not set, using fallback SAR")
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
        "model": "google/gemini-2.0-flash-lite-preview-02-05:free",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 800,
    }

    try:
        logging.info("Sending request to OpenRouter for SAR generation (timeout=20s)")
        resp = requests.post(OPENROUTER_URL, headers=headers, json=body, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        logging.info("SAR generation successful")
        return data["choices"][0]["message"]["content"]
    except requests.Timeout:
        logging.error("SAR generation timed out after 20s. Using fallback.")
        return _fallback_sar(transactions, patterns, risk_score, risk_band)
    except requests.RequestException as e:
        # On any network/auth/model error: do NOT kill the job
        logging.error(f"SAR generation failed: {e}. Using fallback.")
        return _fallback_sar(transactions, patterns, risk_score, risk_band)


LOCATION_PROMPT_TEMPLATE = """
You are a location extraction expert.
Analyze the following transaction descriptions and extract the City, Country, and approximate coordinates (lat, lng).
If a location is not found, return null for those fields.

Return a JSON object where keys are the original descriptions and values are the location data.
Example:
{{
  "UBER *TRIP LONDON HELP.UBER.COM": {{
    "city": "London",
    "country": "United Kingdom",
    "lat": 51.5074,
    "lng": -0.1278
  }}
}}

DESCRIPTIONS:
{descriptions}
"""

def enrich_locations(transactions):
    """
    Extracts location data from transaction details using LLM.
    Returns:
      1. Enriched transactions (list)
      2. Location summary (string)
    """
    if not OPENROUTER_KEY or not transactions:
        print("Skipping location enrichment: No API key or transactions")
        logging.warning("Skipping location enrichment: No API key or transactions")
        return transactions, "Location analysis unavailable (LLM key missing)."

    # 1. Deduplicate descriptions to save tokens
    unique_details = list({tx.get("Details", "").strip() for tx in transactions if tx.get("Details")})
    # Filter out empty or very short descriptions
    unique_details = [d for d in unique_details if len(d) > 3][:30] # Limit to 30 unique descriptions to prevent truncation

    if not unique_details:
        logging.info("No unique details found for location enrichment")
        return transactions, "No identifiable locations found."

    # 2. Call LLM
    prompt = LOCATION_PROMPT_TEMPLATE.format(descriptions=json.dumps(unique_details, indent=2))
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AML Case Processor",
    }
    
    body = {
        "model": "arcee-ai/trinity-large-preview:free", 
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 10000,
#        "response_format": {"type": "json_object"}
    }
    
    location_map = {}
    try:
        print(f"Sending {len(unique_details)} descriptions for location enrichment...")
        logging.info(f"Sending {len(unique_details)} descriptions for location enrichment...")
        resp = requests.post(OPENROUTER_URL, headers=headers, json=body, timeout=45)
        
        if not resp.ok:
            error_details = resp.text
            print(f"LLM API Error: {resp.status_code} - {error_details}")
            logging.error(f"LLM API Error: {resp.status_code} - {error_details}")
            raise Exception(f"API Error {resp.status_code}: {error_details}")

        content = resp.json()["choices"][0]["message"]["content"]
        
        # Parse potential JSON response (handling markdown fences if model adds them)
        # Robust JSON extraction
        import re
        
        # Log raw response for debugging
        with open("location_debug_raw.log", "w", encoding="utf-8") as f:
            f.write(content)

        # 1. Remove <think> tags if present
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
        
        # 2. Extract JSON block using regex (finding the outer-most braces)
        json_match = re.search(r'(\{.*\})', content, re.DOTALL)
        if json_match:
            content = json_match.group(1)
        
        # 3. Cleanup common markdown artifacts just in case
        content = content.replace("```json", "").replace("```", "").strip()
        
        if not content:
            raise ValueError("LLM returned empty content after cleanup")
            
        location_map = json.loads(content)
        print(f"Location enrichment successful. Mapped {len(location_map)} locations.")
        logging.info(f"Location enrichment successful. Mapped {len(location_map)} locations.")
        
    except Exception as e:
        import traceback
        with open("location_error.log", "w") as f:
            f.write(f"Error: {str(e)}\n\nTraceback:\n{traceback.format_exc()}")
            
        print(f"Location enrichment failed: {e}")
        logging.error(f"Location enrichment failed: {e}")
        return transactions, "Location analysis failed due to service error."

    # 3. Merge back into transactions
    enriched_txs = []
    countries = set()
    cities = set()
    
    for tx in transactions:
        details = tx.get("Details", "").strip()
        loc_data = location_map.get(details)
        
        new_tx = tx.copy()
        if loc_data and isinstance(loc_data, dict) and loc_data.get("country"):
            new_tx["location_city"] = loc_data.get("city")
            new_tx["location_country"] = loc_data.get("country")
            new_tx["location_lat"] = loc_data.get("lat")
            new_tx["location_lng"] = loc_data.get("lng")
            
            countries.add(loc_data.get("country"))
            if loc_data.get("city"):
                cities.add(loc_data.get("city"))
        
        enriched_txs.append(new_tx)

    # 4. Generate Summary
    if not countries:
        summary = "No geographic data extracted from descriptions."
    else:
        summary = f"Transactions originated from {len(countries)} countries ({', '.join(list(countries)[:3])}) across {len(cities)} cities."

    return enriched_txs, summary
