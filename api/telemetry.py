"""
Ibn Sina — AgentOps telemetry init.

Degrades gracefully if AGENTOPS_API_KEY is not set.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

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
    except (ImportError, ValueError, KeyError, AttributeError, RuntimeError) as e:
        logger.warning("AgentOps telemetry initialization failed: %s", e)
        return False
