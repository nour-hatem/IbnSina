"""
Ibn Sina — Orders agent.

Reads: everything clinical
Writes: lab_orders, imaging_orders, order_rationale
Model: fast (Groq)

The agent SELECTS from curated panels in clinical/panels.py. It does not
invent lab tests — it justifies why each test in the panel is appropriate
for this specific patient and may add Tier 2 labs if severity warrants.
"""

from __future__ import annotations

import json
import logging

from pydantic import ValidationError

logger = logging.getLogger(__name__)

from langchain_core.messages import HumanMessage, SystemMessage

from api.clinical.panels import get_cap_panel
from api.llm import extract_text, get_llm
from api.schemas import ImagingOrder, LabOrder, PatientEncounter

SYSTEM_PROMPT = """\
You are a paediatric emergency physician ordering investigations for a child
with suspected community-acquired pneumonia (CAP).

You have been given a curated lab panel. Your job is to:
1. Confirm which labs from the panel are appropriate for THIS patient.
2. Add a patient-specific rationale to each ordered test.
3. Indicate if severity warrants the extended (Tier 2) panel.
4. Note the time-critical sequencing: lactate + blood cultures BEFORE the
   first antibiotic dose.

Available panel:
{panel_json}

Patient context:
{patient_context}

Return a JSON object:
{{
  "is_severe": true/false,
  "lab_orders": [
    {{"code": "<LOINC>", "name": "<test>", "priority": "stat"|"routine",
      "rationale": "<patient-specific reason>"}}
  ],
  "imaging_orders": [
    {{"modality": "CXR", "view": "AP", "rationale": "<reason>", "urgency": "stat"|"routine"}}
  ],
  "order_rationale": "<brief paragraph justifying the overall investigation plan>",
  "sequencing_note": "<what must happen before antibiotics>"
}}

Return ONLY valid JSON, no markdown fencing.
"""


def orders_agent(state: PatientEncounter) -> dict:
    is_severe_hint = bool(
        state.red_flags
        or (state.esi_level and state.esi_level <= 2)
        or (state.vitals and state.vitals.spo2 and state.vitals.spo2 < 92)
    )
    labs, imaging = get_cap_panel(severe=is_severe_hint)

    panel_json = json.dumps(
        {"tier1_labs": [l.model_dump() for l in labs], "imaging": [i.model_dump() for i in imaging]},
        indent=2,
    )

    context_parts = []
    if state.patient:
        context_parts.append(f"Patient: {state.patient.full_name}, {state.patient.age_display}")
    if state.chief_complaint:
        context_parts.append(f"Complaint: {state.chief_complaint}")
    if state.hpi:
        context_parts.append(f"HPI: {state.hpi}")
    if state.vitals:
        context_parts.append(f"Vitals: {state.vitals.model_dump_json()}")
    if state.red_flags:
        context_parts.append(f"Red flags: {', '.join(state.red_flags)}")
    if state.allergies:
        context_parts.append(f"Allergies: {', '.join(state.allergies)}")
    if state.pmh:
        context_parts.append(f"PMH: {', '.join(state.pmh)}")

    prompt = SYSTEM_PROMPT.format(
        panel_json=panel_json,
        patient_context="\n".join(context_parts),
    )

    llm = get_llm("fast")
    resp = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content="Generate the investigation orders for this patient."),
    ])

    try:
        data = json.loads(extract_text(resp))
        lab_orders = [LabOrder(**l) for l in data.get("lab_orders", [])]
        imaging_orders = [ImagingOrder(**i) for i in data.get("imaging_orders", [])]
        order_rationale = data.get("order_rationale", "")
    except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as e:
        logger.warning("orders_agent parse error: %s", e)
        labs_fallback, img_fallback = get_cap_panel(severe=is_severe_hint)
        return {
            "lab_orders": labs_fallback,
            "imaging_orders": img_fallback,
            "order_rationale": f"Fallback to standard panel (parse error: {e})",
            "current_node": "orders",
        }

    return {
        "lab_orders": lab_orders,
        "imaging_orders": imaging_orders,
        "order_rationale": order_rationale,
        "current_node": "orders",
    }
