"""
Ibn Sina — AgentOps telemetry init.

Degrades gracefully if AGENTOPS_API_KEY is not set.
"""

from __future__ import annotations

import os

_initialized = False


def init_telemetry() -> bool:
    global _initialized
    if _initialized:
        return True

    key = os.getenv("AGENTOPS_API_KEY", "")
    if not key:
        return False

    try:
        import agentops

        agentops.init(api_key=key, default_tags=["ibn-sina", "ED-CAP"])
        _initialized = True
        return True
    except Exception:
        return False
