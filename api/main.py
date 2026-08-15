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

from dotenv import load_dotenv

load_dotenv()
import shutil
import uuid
from datetime import datetime, timezone

import logging
import traceback

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("ibn_sina")

from api.db import audit_log, save_encounter
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


@app.get("/health/db")
def health_db():
    from api.db import get_supabase

    sb = get_supabase()
    if sb is None:
        return {"supabase": "not_connected", "reason": "missing env vars or client init failed"}
    try:
        sb.table("patients").select("mrn").limit(1).execute()
        return {"supabase": "connected"}
    except Exception as e:
        return {"supabase": "error", "detail": str(e)}


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


@app.get("/encounter/{encounter_id}")
def get_encounter(encounter_id: str):
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
    except Exception:
        pass

    if encounter_id in _encounters:
        return {
            "encounter_id": encounter_id,
            "state": _encounters[encounter_id],
            "next": [],
            "status": "not_started",
        }

    raise HTTPException(404, f"Encounter {encounter_id} not found")


@app.post("/encounter/{encounter_id}/run")
def run_encounter(encounter_id: str):
    if encounter_id not in _encounters:
        raise HTTPException(404, f"Encounter {encounter_id} not found")

    graph, _ = get_graph()
    config = {"configurable": {"thread_id": encounter_id}}

    snapshot = None
    try:
        snapshot = graph.get_state(config)
    except Exception as e:
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
    except Exception as e:
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
    graph, _ = get_graph()
    config = {"configurable": {"thread_id": encounter_id}}

    snapshot = graph.get_state(config)
    if not snapshot or not snapshot.next:
        raise HTTPException(400, "No pending approval gate")

    pending_node = list(snapshot.next)[0]
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
    except Exception as e:
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


@app.post("/upload/cxr/{encounter_id}")
async def upload_cxr(encounter_id: str, file: UploadFile = File(...)):
    if encounter_id not in _encounters:
        raise HTTPException(404, f"Encounter {encounter_id} not found")

    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "jpeg"
    filename = f"{encounter_id}_cxr.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Update encounter state with image path
    _encounters[encounter_id]["cxr_image_path"] = filepath

    # Also update the graph state
    graph, _ = get_graph()
    config = {"configurable": {"thread_id": encounter_id}}
    try:
        graph.update_state(config, {"cxr_image_path": filepath})
    except Exception:
        pass

    audit_log(encounter_id, "system", "cxr_uploaded", payload={"path": filepath})

    return {"encounter_id": encounter_id, "cxr_path": filepath, "status": "uploaded"}
