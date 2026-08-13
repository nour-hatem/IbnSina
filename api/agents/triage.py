"""
Ibn Sina — Triage agent.

Reads: patient, chief_complaint, vitals
Writes: esi_level, red_flags
Model: fast (Groq)
"""

from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage

from api.llm import extract_text, get_llm
from api.schemas import PatientEncounter


SYSTEM_PROMPT = """\
You are a paediatric emergency triage nurse. Assign an ESI (Emergency Severity
Index) level 1-5 and identify red flags from the patient data below.

ESI levels (paediatric context):
  1 - Resuscitation: apnoea, pulseless, unresponsive
  2 - Emergent: severe respiratory distress, altered consciousness, SpO2 <90%
  3 - Urgent: moderate distress, abnormal vitals, needs multiple resources
  4 - Less urgent: mildly abnormal, needs one resource
  5 - Non-urgent: well-appearing, no resources needed

Return a JSON object:
{
  "esi_level": <1-5>,
  "esi_rationale": "<one sentence>",
  "red_flags": ["<flag1>", "<flag2>", ...]
}

Red flags to check for (list only those PRESENT):
- SpO2 < 92% on room air
- Respiratory rate above age-specific threshold
- Grunting, nasal flaring, chest indrawing
- Altered consciousness (AVPU not A)
- Unable to drink or breastfeed
- Capillary refill >= 3 seconds
- Temperature >= 39°C or < 35.5°C in young infant
- Signs of severe dehydration

Return ONLY valid JSON, no markdown fencing.
"""


def triage_agent(state: PatientEncounter) -> dict:
    context_parts = []
    if state.patient:
        context_parts.append(
            f"Patient: {state.patient.full_name}, {state.patient.age_display}, "
            f"{state.patient.sex}"
        )
    if state.chief_complaint:
        context_parts.append(f"Chief complaint: {state.chief_complaint}")
    if state.vitals:
        context_parts.append(f"Vitals: {state.vitals.model_dump_json()}")

    if not context_parts:
        return {"errors": ["triage_agent: no patient or vitals data available"]}

    llm = get_llm("fast")
    resp = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content="\n\n".join(context_parts)),
    ])

    try:
        data = json.loads(extract_text(resp))
        esi = int(data["esi_level"])
        flags = [str(f) for f in data.get("red_flags", [])]
    except Exception as e:
        return {"errors": [f"triage_agent parse error: {e}"]}

    return {
        "esi_level": esi,
        "red_flags": flags,
        "current_node": "triage",
    }
