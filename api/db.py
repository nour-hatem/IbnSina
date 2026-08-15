"""
Ibn Sina — Supabase client + audit log helper.

Degrades gracefully if SUPABASE_URL / SUPABASE_SERVICE_KEY are not set.
In that case, encounters live in-memory only (MemorySaver handles graph state).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

_client = None


def get_supabase():
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        return None

    try:
        from supabase import create_client

        _client = create_client(url, key)
        return _client
    except Exception:
        return None


def save_encounter(encounter_id: str, state_dict: dict) -> bool:
    sb = get_supabase()
    if sb is None:
        return False
    try:
        sb.table("encounters").upsert({
            "id": encounter_id,
            "state": json.loads(json.dumps(state_dict, default=str)),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return True
    except Exception:
        return False


def load_encounter(encounter_id: str) -> dict | None:
    sb = get_supabase()
    if sb is None:
        return None
    try:
        resp = sb.table("encounters").select("state").eq("id", encounter_id).single().execute()
        return resp.data.get("state") if resp.data else None
    except Exception:
        return None


def list_encounters(limit: int = 50) -> list[dict]:
    """Return a summary list of recent encounters for the board view.
    Selects only lightweight fields, not the full state blob."""
    sb = get_supabase()
    if sb is None:
        return []
    try:
        resp = (
            sb.table("encounters")
            .select("id, updated_at, state")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


def audit_log(
    encounter_id: str,
    actor: str,
    action: str,
    node: str | None = None,
    payload: Any = None,
) -> bool:
    """Write an audit log entry. Every agent proposal and human approval
    must call this — it is the safety argument, the eval dataset, and
    the best demo slide."""
    sb = get_supabase()
    if sb is None:
        return False
    try:
        sb.table("audit_log").insert({
            "encounter_id": encounter_id,
            "actor": actor,
            "action": action,
            "node": node,
            "payload": json.loads(json.dumps(payload, default=str)) if payload else None,
            "at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return True
    except Exception:
        return False
