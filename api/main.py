"""
Ibn Sina — FastAPI server.

Routes:
  GET  /health                     -> liveness check
  POST /encounter                  -> create a new encounter
  GET  /encounter/{id}             -> get encounter state
  POST /encounter/{id}/run         -> step the graph forward
  POST /encounter/{id}/approve     -> approve a gate (radiology / synthesis)
  POST /upload/cxr/{encounter_id}  -> upload a chest X-ray image
"""

from __future__ import annotations

import os
import re
from typing import Any

from dotenv import load_dotenv

load_dotenv()
import asyncio
import json
import logging
import shutil
import traceback
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("ibn_sina")

from api.db import audit_log, load_encounter, save_encounter
from api.graph import get_graph
from api.schemas import Approval, PatientEncounter
from api.telemetry import init_telemetry

app = FastAPI(
    title="Ibn Sina — ED Decision Support",
    version="0.1.0",
    description="Paediatric emergency department automation and decision-support system. "
    "Research prototype — NOT for clinical use.",
)

cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_telemetry()

# In-memory encounter store (fallback when Supabase is unavailable)
_encounters: dict[str, dict] = {}

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class CreateEncounterRequest(BaseModel):
    raw_registration: str
    vitals: dict | None = None


class ApproveRequest(BaseModel):
    gate: str
    approved_by: str = "clinician"
    action: str = "accept"
    edits: dict | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok", "service": "ibn-sina", "version": "0.1.0"}


@app.get("/encounters")
def list_all_encounters():
    from api.db import list_encounters
    rows = list_encounters()
    summaries = []
    for row in rows:
        state = row.get("state") or {}
        patient_raw = state.get("patient")
        patient_name = None
        if isinstance(patient_raw, dict):
            patient_name = patient_raw.get("full_name")
        elif isinstance(patient_raw, str):
            match = re.search(r"full_name='([^']+)'", patient_raw)
            if match:
                patient_name = match.group(1)

        disp_raw = state.get("disposition")
        disposition_str = None
        if isinstance(disp_raw, dict):
            disposition_str = disp_raw.get("decision")
        elif isinstance(disp_raw, str):
            match = re.search(r"decision='([^']+)'", disp_raw)
            if match:
                disposition_str = match.group(1)

        summaries.append({
            "encounter_id": row["id"],
            "updated_at": row["updated_at"],
            "patient_name": patient_name,
            "esi_level": state.get("esi_level"),
            "chief_complaint": state.get("chief_complaint"),
            "current_node": state.get("current_node"),
            "disposition": disposition_str,
        })
    return {"encounters": summaries}


@app.post("/encounter")
def create_encounter(req: CreateEncounterRequest):
    encounter_id = str(uuid.uuid4())

    initial_state = {
        "encounter_id": encounter_id,
        "raw_registration": req.raw_registration,
    }

    if req.vitals:
        initial_state["vitals"] = req.vitals

    _encounters[encounter_id] = initial_state
    save_encounter(encounter_id, initial_state)
    audit_log(encounter_id, "system", "created", payload={"raw_registration_length": len(req.raw_registration)})

    return {"encounter_id": encounter_id, "status": "created"}


def _parse_pydantic_repr(val: str) -> dict | str:
    """Read-time compatibility shim for legacy stringified Pydantic repr data.
    New writes via save_encounter produce clean JSON dicts directly."""
    if not isinstance(val, str) or "=" not in val:
        return val
    pairs = re.findall(r"(\w+)=(None|'[^']*'|\"[^\"]*\"|\d+\.?\d*|True|False)", val)
    if not pairs:
        return val
    d = {}
    for k, v in pairs:
        if v == "None":
            d[k] = None
        elif v == "True":
            d[k] = True
        elif v == "False":
            d[k] = False
        elif (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
            d[k] = v[1:-1]
        elif "." in v:
            try:
                d[k] = float(v)
            except ValueError:
                d[k] = v
        else:
            try:
                d[k] = int(v)
            except ValueError:
                d[k] = v
    return d if d else val


def _normalize_state(obj: Any) -> Any:
    if hasattr(obj, "model_dump"):
        return _normalize_state(obj.model_dump(mode="json"))
    if isinstance(obj, str):
        return _parse_pydantic_repr(obj)
    if isinstance(obj, dict):
        return {k: _normalize_state(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalize_state(v) for v in obj]
    return obj


def _get_or_load_encounter(encounter_id: str) -> dict | None:
    if encounter_id in _encounters:
        return _encounters[encounter_id]

    raw_state = load_encounter(encounter_id)
    if raw_state:
        state = _normalize_state(raw_state)
        _encounters[encounter_id] = state
        try:
            graph, _ = get_graph()
            config = {"configurable": {"thread_id": encounter_id}}
            snapshot = graph.get_state(config)
            if not snapshot or not snapshot.values:
                current_node = state.get("current_node")
                if current_node:
                    graph.update_state(config, state, as_node=current_node)
                else:
                    graph.update_state(config, state)
        except (KeyError, ValueError, AttributeError, TypeError, RuntimeError) as e:
            logger.warning("Failed to hydrate graph state for %s: %s", encounter_id, e)
        return state

    return None


@app.get("/encounter/{encounter_id}")
def get_encounter(encounter_id: str):
    encounter_state = _get_or_load_encounter(encounter_id)
    if not encounter_state:
        raise HTTPException(404, f"Encounter {encounter_id} not found")

    graph, _ = get_graph()
    config = {"configurable": {"thread_id": encounter_id}}

    try:
        snapshot = graph.get_state(config)
        if snapshot and snapshot.values:
            state = snapshot.values
            if isinstance(state, PatientEncounter):
                state = state.model_dump()
            next_nodes = list(snapshot.next) if snapshot.next else []
            return {
                "encounter_id": encounter_id,
                "state": state,
                "next": next_nodes,
                "status": "interrupted" if next_nodes else "complete",
            }
    except (KeyError, ValueError, AttributeError, TypeError, RuntimeError) as e:
        logger.warning("Failed to retrieve snapshot for %s: %s", encounter_id, e)

    return {
        "encounter_id": encounter_id,
        "state": encounter_state,
        "next": [],
        "status": "not_started",
    }


@app.post("/encounter/{encounter_id}/run")
def run_encounter(encounter_id: str):
    if not _get_or_load_encounter(encounter_id):
        raise HTTPException(404, f"Encounter {encounter_id} not found")

    graph, _ = get_graph()
    config = {"configurable": {"thread_id": encounter_id}}

    snapshot = None
    try:
        snapshot = graph.get_state(config)
    except (KeyError, ValueError, AttributeError, TypeError, RuntimeError) as e:
        logger.warning("get_state failed: %s", e)

    has_checkpoint = bool(snapshot and snapshot.values)
    is_interrupted = bool(has_checkpoint and snapshot.next)
    is_complete = bool(has_checkpoint and not snapshot.next)

    if is_complete:
        # Already finished — return current state without re-running
        current_state = snapshot.values
        if isinstance(current_state, PatientEncounter):
            current_state = current_state.model_dump()
        return {"encounter_id": encounter_id, "state": current_state, "next": [], "status": "complete"}

    try:
        result = None
        if is_interrupted or (has_checkpoint and not is_complete):
            # Resume from interrupt or mid-run checkpoint
            for event in graph.stream(None, config, stream_mode="values"):
                result = event
        else:
            # Fresh start
            initial = _encounters[encounter_id]
            for event in graph.stream(initial, config, stream_mode="values"):
                result = event
    except (KeyError, ValueError, AttributeError, TypeError, RuntimeError, httpx.HTTPError, json.JSONDecodeError) as e:
        tb = traceback.format_exc()
        logger.error("Graph execution error for %s:\n%s", encounter_id, tb)
        raise HTTPException(500, detail=f"Graph error: {e}\n\n{tb}")

    if result:
        if isinstance(result, PatientEncounter):
            state_dict = result.model_dump()
        elif isinstance(result, dict):
            state_dict = result
        else:
            state_dict = dict(result)
        _encounters[encounter_id] = state_dict
        save_encounter(encounter_id, state_dict)

    snapshot = graph.get_state(config)
    next_nodes = list(snapshot.next) if snapshot and snapshot.next else []

    current_state = snapshot.values if snapshot and snapshot.values else _encounters.get(encounter_id, {})
    if isinstance(current_state, PatientEncounter):
        current_state = current_state.model_dump()

    audit_log(encounter_id, "system", "graph_step", payload={"next": next_nodes})

    return {
        "encounter_id": encounter_id,
        "state": current_state,
        "next": next_nodes,
        "status": "interrupted" if next_nodes else "complete",
    }


@app.post("/encounter/{encounter_id}/approve")
def approve_gate(encounter_id: str, req: ApproveRequest):
    if not _get_or_load_encounter(encounter_id):
        raise HTTPException(404, f"Encounter {encounter_id} not found")
    graph, _ = get_graph()
    config = {"configurable": {"thread_id": encounter_id}}

    snapshot = graph.get_state(config)
    if not snapshot or not snapshot.next:
        raise HTTPException(400, "No pending approval gate")

    pending_node = next(iter(snapshot.next))
    if req.gate and req.gate != pending_node:
        raise HTTPException(
            400,
            f"Gate mismatch: pending is '{pending_node}', got '{req.gate}'",
        )

    approval = Approval(
        gate=pending_node,
        approved_by=req.approved_by,
        approved_at=datetime.now(timezone.utc).isoformat(),
        action=req.action,
        edits=req.edits,
    )

    if req.action == "reject":
        err_msg = f"Gate '{pending_node}' rejected by {req.approved_by}"
        update = {"approvals": [approval], "errors": [err_msg]}
        if req.edits:
            update.update(req.edits)

        graph.update_state(config, update)
        audit_log(encounter_id, f"user:{req.approved_by}", "reject", node=pending_node)

        snapshot = graph.get_state(config)
        next_nodes = list(snapshot.next) if snapshot and snapshot.next else []
        current_state = snapshot.values if snapshot and snapshot.values else _encounters.get(encounter_id, {})
        if isinstance(current_state, PatientEncounter):
            current_state = current_state.model_dump()

        _encounters[encounter_id] = current_state
        save_encounter(encounter_id, current_state)

        return {
            "encounter_id": encounter_id,
            "state": current_state,
            "next": next_nodes,
            "status": "rejected",
        }

    update = {"approvals": [approval]}
    if req.edits:
        update.update(req.edits)

    graph.update_state(config, update)
    audit_log(encounter_id, f"user:{req.approved_by}", req.action, node=pending_node)

    # Resume the graph
    try:
        result = None
        for event in graph.stream(None, config, stream_mode="values"):
            result = event
    except (KeyError, ValueError, AttributeError, TypeError, RuntimeError, httpx.HTTPError, json.JSONDecodeError) as e:
        tb = traceback.format_exc()
        logger.error("Graph resume error for %s:\n%s", encounter_id, tb)
        raise HTTPException(500, detail=f"Graph error: {e}\n\n{tb}")

    if result:
        state_dict = result.model_dump() if isinstance(result, PatientEncounter) else dict(result)
        _encounters[encounter_id] = state_dict
        save_encounter(encounter_id, state_dict)

    snapshot = graph.get_state(config)
    next_nodes = list(snapshot.next) if snapshot and snapshot.next else []
    current_state = snapshot.values if snapshot and snapshot.values else _encounters.get(encounter_id, {})
    if isinstance(current_state, PatientEncounter):
        current_state = current_state.model_dump()

    return {
        "encounter_id": encounter_id,
        "state": current_state,
        "next": next_nodes,
        "status": "interrupted" if next_nodes else "complete",
    }


def _save_file(uploaded_file: UploadFile, target_path: str):
    with open(target_path, "wb") as f:
        shutil.copyfileobj(uploaded_file.file, f)


@app.post("/upload/cxr/{encounter_id}")
async def upload_cxr(encounter_id: str, file: UploadFile):
    if not _get_or_load_encounter(encounter_id):
        raise HTTPException(404, f"Encounter {encounter_id} not found")

    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "jpeg"
    filename = f"{encounter_id}_cxr.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    await asyncio.to_thread(_save_file, file, filepath)

    # Update encounter state with image path
    _encounters[encounter_id]["cxr_image_path"] = filepath

    # Also update the graph state
    graph, _ = get_graph()
    config = {"configurable": {"thread_id": encounter_id}}
    try:
        graph.update_state(config, {"cxr_image_path": filepath})
    except (KeyError, ValueError, AttributeError, TypeError, RuntimeError) as e:
        logger.warning("Failed to update graph state with CXR path for %s: %s", encounter_id, e)

    audit_log(encounter_id, "system", "cxr_uploaded", payload={"path": filepath})

    return {"encounter_id": encounter_id, "cxr_path": filepath, "status": "uploaded"}
