# app/job_store.py

from typing import Dict, Any

# Simple in-memory job store for now
JOB_STORE: Dict[str, Dict[str, Any]] = {}
