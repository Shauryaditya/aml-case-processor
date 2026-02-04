
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.llm_client import enrich_locations

# Mock transactions
dummy_txs = [
    {"Date": "2023-01-01", "Details": "STARBUCKS LONDON", "amount": 5.00},
    {"Date": "2023-01-02", "Details": "UBER PARIS", "amount": 15.00}
]

print("Testing enrich_locations...")
try:
    enriched, summary = enrich_locations(dummy_txs)
    print("Success!")
    print("Summary:", summary)
    print("Enriched TXs:", enriched)
except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()
