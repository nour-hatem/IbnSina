"""
Ibn Sina — Radiology agent (CXR reader).

Reads: imaging_orders, cxr_image_path
Writes: cxr_read (CXRRead)
Model: vision (Gemini 2.5 Flash)

This agent is NOT a validated classifier. It assists a radiologist by
drafting a structured preliminary read. Ordinal likelihood only
(low / intermediate / high) — no numeric probabilities.
"""

from __future__ import annotations

import base64
import json
import logging
import os

from pydantic import ValidationError

logger = logging.getLogger(__name__)

from langchain_core.messages import HumanMessage, SystemMessage

from api.llm import extract_text, get_llm, read_cache, write_cache
from api.schemas import CXRRead, PatientEncounter

SYSTEM_PROMPT = """\
You are assisting a paediatric radiologist by drafting a STRUCTURED PRELIMINARY
read of a chest radiograph. You are NOT a diagnostic device and your output is
NOT a final report.

Rules — violating any of these is a failure:
1. Describe ONLY what is visible. Never infer clinical history from the image.
2. If image quality limits interpretation (rotation, penetration, AP projection,
   incomplete inspiration, motion), you MUST state it in "limitations".
3. Never output a numeric probability. Use ONLY: "low", "intermediate", "high".
4. If you cannot see a finding clearly, say so. Absence of a statement is not
   evidence of absence.
5. Always report the following search pattern explicitly:
   airway/trachea > lung fields (zone by zone) > pleura/costophrenic angles >
   cardiac silhouette & mediastinum > bones > soft tissue > lines/tubes/devices.
6. Flag any CRITICAL finding immediately in findings[0]: pneumothorax,
   pneumoperitoneum, malpositioned tube/line, large effusion, suspected mass.
7. This is a PAEDIATRIC film — thymus shadow is NORMAL in young children,
   do NOT mistake it for mediastinal widening or cardiomegaly.

Return a JSON object:
{
  "findings": ["<finding1>", "<finding2>", ...],
  "impression": "<summary impression paragraph>",
  "pneumonia_likelihood": "low" | "intermediate" | "high",
  "laterality": "right" | "left" | "bilateral" | "none" | null,
  "multilobar": true | false,
  "pleural_effusion": true | false,
  "confidence": <float 0-1 representing YOUR confidence in the read quality>,
  "limitations": "<must not be empty — state projection type at minimum>"
}

Return ONLY valid JSON, no markdown fencing.
"""


def _load_image_as_base64(path: str) -> str | None:
    if not path or not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        data = f.read()
    return base64.b64encode(data).decode("utf-8")


def radiology_agent(state: PatientEncounter) -> dict:
    if not state.cxr_image_path:
        return {"errors": ["radiology_agent: no cxr_image_path provided"]}

    img_b64 = _load_image_as_base64(state.cxr_image_path)
    if not img_b64:
        return {"errors": [f"radiology_agent: image not found at {state.cxr_image_path}"]}

    cache_key = f"radiology:{state.cxr_image_path}"
    cached = read_cache(cache_key)
    if cached:
        try:
            cxr = CXRRead(**json.loads(cached))
            return {"cxr_read": cxr, "current_node": "radiology"}
        except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as e:
            logger.warning("Cached CXR read invalid, ignoring: %s", e)

    ext = state.cxr_image_path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")

    llm = get_llm("vision")
    resp = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=[
            {"type": "text", "text": "Read this paediatric chest radiograph following the structured search pattern."},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
        ]),
    ])

    try:
        raw = extract_text(resp)
        if "```" in raw:
            raw = raw.split("```json")[-1].split("```")[0] if "```json" in raw else raw.split("```")[1].split("```")[0]
        data = json.loads(raw.strip())
        data["model_used"] = os.getenv("MODEL_VISION", "gemini-3.6-flash")
        cxr = CXRRead(**data)
        write_cache(cache_key, json.dumps(data))
    except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as e:
        logger.warning("radiology_agent parse error: %s", e)
        return {"errors": [f"radiology_agent parse error: {e}\nRaw: {extract_text(resp)[:500]}"]}

    return {
        "cxr_read": cxr,
        "current_node": "radiology",
    }
