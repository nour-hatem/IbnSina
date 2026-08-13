"""
Ibn Sina — History agent.

Reads: patient, chief_complaint (+ raw_registration for additional context)
Writes: hpi, pmh, medications, allergies, family_hx, surgical_hx,
        birth_history, immunisation_status, developmental_status,
        social_hx, soap_note
Model: fast (Groq)
"""

from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage

from api.llm import extract_text, get_llm
from api.schemas import PatientEncounter


SYSTEM_PROMPT = """\
You are a paediatric emergency physician. Structure the clinical history from
the provided text into a comprehensive paediatric clerking.

Return a JSON object:
{
  "hpi": "<history of presenting illness — narrative paragraph>",
  "pmh": ["<past medical history item>", ...],
  "medications": ["<current medication>", ...],
  "allergies": ["<allergy>", ...],
  "family_hx": ["<family history item>", ...],
  "surgical_hx": ["<surgical history item>", ...],
  "birth_history": "<birth details — gestation, delivery mode, birth weight, NICU>",
  "immunisation_status": "<up to date / incomplete — specify gaps>",
  "developmental_status": "<milestones summary>",
  "social_hx": "<living situation, carers, smokers, relevant social factors>",
  "soap_note": "<structured SOAP note: Subjective, Objective, Assessment, Plan>"
}

Rules:
- Extract ONLY what is present in the source text. Do NOT invent.
- Use empty lists [] and null for absent data, not made-up values.
- The SOAP note Assessment should say "pending investigations" not a diagnosis.
- Flag any social vulnerability factors prominently in social_hx.
- Return ONLY valid JSON, no markdown fencing.
"""


def history_agent(state: PatientEncounter) -> dict:
    parts = []
    if state.raw_registration:
        parts.append(f"Registration data:\n{state.raw_registration}")
    if state.patient:
        parts.append(f"Patient: {state.patient.full_name}, {state.patient.age_display}, {state.patient.sex}")
    if state.chief_complaint:
        parts.append(f"Chief complaint: {state.chief_complaint}")
    if state.vitals:
        parts.append(f"Vitals: {state.vitals.model_dump_json()}")

    if not parts:
        return {"errors": ["history_agent: no clinical data available"]}

    llm = get_llm("fast")
    resp = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content="\n\n".join(parts)),
    ])

    try:
        data = json.loads(extract_text(resp))
    except Exception as e:
        return {"errors": [f"history_agent parse error: {e}"]}

    soap = data.get("soap_note")
    if isinstance(soap, dict):
        soap = "\n".join(f"{k}: {v}" for k, v in soap.items() if v)

    return {
        "hpi": data.get("hpi") if isinstance(data.get("hpi"), str) else json.dumps(data.get("hpi")),
        "pmh": data.get("pmh", []),
        "medications": data.get("medications", []),
        "allergies": data.get("allergies", []),
        "family_hx": data.get("family_hx", []),
        "surgical_hx": data.get("surgical_hx", []),
        "birth_history": data.get("birth_history") if isinstance(data.get("birth_history"), str) else str(data.get("birth_history", "")),
        "immunisation_status": data.get("immunisation_status") if isinstance(data.get("immunisation_status"), str) else str(data.get("immunisation_status", "")),
        "developmental_status": data.get("developmental_status") if isinstance(data.get("developmental_status"), str) else str(data.get("developmental_status", "")),
        "social_hx": data.get("social_hx") if isinstance(data.get("social_hx"), str) else str(data.get("social_hx", "")),
        "soap_note": soap if isinstance(soap, str) else str(soap or ""),
        "current_node": "history",
    }
