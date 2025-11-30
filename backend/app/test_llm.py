from llm_client import generate_sar

# simple dummy test
transactions = [
    {"amount": 15000, "country": "USA", "date": "2023-05-20"},
    {"amount": 9000, "country": "XYZ", "date": "2023-05-21"}
]

patterns = [
    {"rule": "large_amount", "matches": [{"amount": 15000}]}
]

sar = generate_sar(transactions, patterns)
print("\n--- SAR OUTPUT ---\n")
print(sar)
