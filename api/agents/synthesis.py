"""
Ibn Sina — Synthesis agent.

Reads: all encounter fields
Writes: differential, final_diagnosis, severity, disposition, ed_report_md
Model: reason (Gemini 2.5 Flash)

Severity scoring is DETERMINISTIC (clinical/scores.py). The LLM produces
the differential, diagnosis, and narrative report. Disposition comes from
clinical/rules.py applied to the computed severity.
"""

from __future__ import annotations

import json
import logging

from pydantic import ValidationError

logger = logging.getLogger(__name__)

from langchain_core.messages import HumanMessage, SystemMessage

from api.clinical.rules import disposition_from_severity
from api.clinical.scores import paediatric_severity
from api.llm import extract_text, get_llm
from api.schemas import DifferentialItem, PatientEncounter

SYSTEM_PROMPT = """\
You are a senior paediatric emergency physician synthesising all available data
into a final clinical assessment.

Available data:
{encounter_summary}

Your tasks:
1. Generate a ranked differential diagnosis (most likely first).
2. For chest complaints, you MUST explicitly address these cannot-miss diagnoses
   even if only to exclude them with reasoning:
   - Foreign body aspiration (especially with acute onset + unilateral signs)
   - Bacterial pneumonia
   - Viral pneumonia / bronchiolitis
   - Pleural effusion / empyema
   - Pneumothorax
   - Myocarditis / cardiac cause
   - Sepsis from any source
3. State a final working diagnosis.
4. Write a concise ED report in markdown format.

Return a JSON object:
{{
  "differential": [
    {{
      "diagnosis": "<name>",
      "icd10": "<code or null>",
      "likelihood": "high" | "moderate" | "low",
      "supporting_evidence": ["<evidence>", ...],
      "refuting_evidence": ["<evidence>", ...],
      "cannot_miss": true | false
    }}
  ],
  "final_diagnosis": "<working diagnosis statement>",
  "report_narrative": "<markdown ED report — include presenting complaint, key findings, investigations summary, assessment, and plan>"
}}

Rules:
- Do NOT compute severity scores; they are provided separately.
- Do NOT decide disposition; it is computed from the scores.
- Every cannot-miss diagnosis must appear in the differential even if likelihood is "low".
- Return ONLY valid JSON, no markdown fencing.
"""


def _build_encounter_summary(state: PatientEncounter) -> str:
    parts = []
    if state.patient:
        parts.append(f"Patient: {state.patient.full_name}, {state.patient.age_display}, {state.patient.sex}")
    if state.chief_complaint:
        parts.append(f"Chief complaint: {state.chief_complaint}")
    if state.vitals:
        parts.append(f"Vitals: {state.vitals.model_dump_json()}")
    if state.hpi:
        parts.append(f"HPI: {state.hpi}")
    if state.pmh:
        parts.append(f"PMH: {', '.join(state.pmh)}")
    if state.medications:
        parts.append(f"Medications: {', '.join(state.medications)}")
    if state.allergies:
        parts.append(f"Allergies: {', '.join(state.allergies)}")
    if state.family_hx:
        parts.append(f"Family Hx: {', '.join(state.family_hx)}")
    if state.birth_history:
        parts.append(f"Birth history: {state.birth_history}")
    if state.immunisation_status:
        parts.append(f"Immunisations: {state.immunisation_status}")
    if state.social_hx:
        parts.append(f"Social: {state.social_hx}")
    if state.red_flags:
        parts.append(f"Red flags: {', '.join(state.red_flags)}")
    if state.lab_orders:
        lab_results = []
        for lab in state.lab_orders:
            if lab.result_value:
                lab_results.append(f"{lab.name}: {lab.result_value} [{lab.result_flag or 'pending'}]")
        if lab_results:
            parts.append("Lab results:\n" + "\n".join(f"  - {r}" for r in lab_results))
    if state.cxr_read:
        parts.append(f"CXR Read:\n  Impression: {state.cxr_read.impression}")
        parts.append(f"  Pneumonia likelihood: {state.cxr_read.pneumonia_likelihood}")
        parts.append(f"  Findings: {', '.join(state.cxr_read.findings)}")
        parts.append(f"  Limitations: {state.cxr_read.limitations}")
    return "\n\n".join(parts)


def synthesis_agent(state: PatientEncounter) -> dict:
    summary = _build_encounter_summary(state)
    result: dict = {"current_node": "synthesis"}

    # --- 1. Deterministic severity scoring ---
    if state.vitals and state.patient:
        lab_wbc = None
        lab_lactate = None
        for lab in state.lab_orders:
            if "white" in lab.name.lower() and lab.result_value:
                try:
                    lab_wbc = float(lab.result_value.split()[0])
                except (ValueError, IndexError):
                    pass
            if "lactate" in lab.name.lower() and lab.result_value:
                try:
                    lab_lactate = float(lab.result_value.split()[0])
                except (ValueError, IndexError):
                    pass

        multilobar = state.cxr_read.multilobar if state.cxr_read else False
        effusion = state.cxr_read.pleural_effusion if state.cxr_read else False

        severity = paediatric_severity(
            vitals=state.vitals,
            age_months=state.patient.age_months,
            lab_wbc=lab_wbc,
            lab_lactate=lab_lactate,
            multilobar=multilobar,
            pleural_effusion=effusion,
        )
        result["severity"] = severity

        # --- 2. Disposition from rules ---
        disposition = disposition_from_severity(severity, state)
        result["disposition"] = disposition

    # --- 3. LLM-generated differential + diagnosis + report ---
    prompt = SYSTEM_PROMPT.format(encounter_summary=summary)
    llm = get_llm("reason")

    try:
        resp = llm.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content="Synthesise the assessment now."),
        ])
        raw = extract_text(resp)
        if "```" in raw:
            raw = raw.split("```json")[-1].split("```")[0] if "```json" in raw else raw.split("```")[1].split("```")[0]
        data = json.loads(raw.strip())

        differential = [DifferentialItem(**d) for d in data.get("differential", [])]
        result["differential"] = differential
        result["final_diagnosis"] = data.get("final_diagnosis")

        report = data.get("report_narrative", "")
        if result.get("severity"):
            sev = result["severity"]
            report += "\n\n---\n**Severity (computed, not LLM-generated):**\n"
            report += f"- WHO classification: {sev.classification}\n"
            report += f"- Danger signs ({sev.who_danger_sign_count}): {', '.join(sev.who_danger_signs) if sev.who_danger_signs else 'none'}\n"
            report += f"- PIDS/IDSA severe: {'Yes' if sev.idsa_severe else 'No'}\n"
        if result.get("disposition"):
            disp = result["disposition"]
            report += f"\n**Disposition:** {disp.decision}\n"
            report += f"- Rationale: {disp.rationale}\n"
            report += f"- Basis: {disp.severity_basis}\n"
        result["ed_report_md"] = report

    except (json.JSONDecodeError, ValidationError, KeyError, TypeError, ValueError, RuntimeError) as e:
        logger.warning("synthesis_agent LLM error: %s", e)
        result["errors"] = [f"synthesis_agent LLM error: {e}"]
        result["final_diagnosis"] = "Unable to generate — see errors"
        result["ed_report_md"] = f"Synthesis failed: {e}"

    return result
