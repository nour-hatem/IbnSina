"""
Ibn Sina — Intake agent.

Reads: raw_registration
Writes: patient, insurance, chief_complaint
Model: fast (Groq)
"""

from __future__ import annotations

import json
import logging
import uuid

from pydantic import ValidationError

logger = logging.getLogger(__name__)

from langchain_core.messages import HumanMessage, SystemMessage

from api.llm import extract_text, get_llm
from api.schemas import Insurance, Patient, PatientEncounter

SYSTEM_PROMPT = """\
You are a hospital reception data-entry assistant. Extract structured patient
data from the registration text below.

Return a JSON object with exactly these keys:
{
  "patient": {
    "mrn": "<string>",
    "full_name": "<string>",
    "age_months": <int>,
    "age_display": "<string like '4 years' or '14 months'>",
    "sex": "male" | "female" | "other",
    "dob": "<YYYY-MM-DD or null>",
    "guardian": "<string or null>",
    "weight_kg": <float or null>
  },
  "insurance": {
    "provider": "<string or null>",
    "policy_number": "<string or null>",
    "plan": "<string or null>",
    "coverage_status": "active" | "expired" | "unknown" | "self_pay",
    "copay_note": "<string or null>"
  },
  "chief_complaint": "<string — the patient's or guardian's own words>"
}

Rules:
- Extract ONLY what is present. Do not invent data.
- Age must be in months for paediatric dosing (e.g., 4 years = 48 months).
- If insurance info is absent, set coverage_status to "unknown".
- chief_complaint should be a brief phrase from the guardian's report.
- Return ONLY valid JSON, no markdown fencing.
"""


def intake_agent(state: PatientEncounter) -> dict:
    if not state.raw_registration:
        return {"errors": ["intake_agent: no raw_registration provided"]}

    llm = get_llm("fast")
    resp = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=state.raw_registration),
    ])

    try:
        raw = extract_text(resp)
        if "```" in raw:
            raw = raw.split("```json")[-1].split("```")[0] if "```json" in raw else raw.split("```")[1].split("```")[0]
        data = json.loads(raw.strip())
        p = data["patient"]
        if not p.get("mrn"):
            p["mrn"] = f"IBN-{uuid.uuid4().hex[:6].upper()}"
        patient = Patient(**p)
        insurance = Insurance(**data["insurance"])
        complaint = data["chief_complaint"]
    except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as e:
        logger.warning("intake_agent parse error: %s", e)
        return {"errors": [f"intake_agent parse error: {e}"]}

    return {
        "patient": patient,
        "insurance": insurance,
        "chief_complaint": complaint,
        "current_node": "intake",
    }
