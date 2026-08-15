"""
Ibn Sina — LangGraph StateGraph wiring.

6 nodes, ESI-based conditional routing, interrupt_before at the two
clinician-approval gates (orders -> radiology, radiology -> synthesis).
"""

from __future__ import annotations

import logging
import os
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from api.agents.history import history_agent
from api.agents.intake import intake_agent
from api.agents.orders import orders_agent
from api.agents.radiology import radiology_agent
from api.agents.synthesis import synthesis_agent
from api.agents.triage import triage_agent
from api.schemas import PatientEncounter

logger = logging.getLogger(__name__)


def get_default_checkpointer():
    """Return a persistent PostgresSaver checkpointer if database URL is provided,
    otherwise fallback to MemorySaver.
    """
    db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("SUPABASE_DB_URL")
    if db_url:
        try:
            from langgraph.checkpoint.postgres import PostgresSaver

            saver_cm = PostgresSaver.from_conn_string(db_url)
            saver = saver_cm.__enter__()
            saver.setup()
            logger.info("Initialized PostgresSaver persistent checkpointer.")
            return saver
        except Exception as e:
            logger.warning("Failed to initialize PostgresSaver (%s); falling back to MemorySaver", e)

    return MemorySaver()


def _esi_router(state: PatientEncounter) -> str:
    """Route based on ESI level.

    ESI 1 (resuscitation): bypass directly to synthesis for immediate escalation.
    ESI 2-5: standard path through history -> orders -> radiology -> synthesis.
    """
    if state.esi_level is not None and state.esi_level <= 1:
        return "resuscitation"
    return "standard"


def build_graph(checkpointer=None):
    """Build and compile the encounter graph.

    Returns (compiled_graph, checkpointer).
    """
    if checkpointer is None:
        checkpointer = get_default_checkpointer()

    graph = StateGraph(PatientEncounter)

    graph.add_node("intake", intake_agent)
    graph.add_node("triage", triage_agent)
    graph.add_node("history", history_agent)
    graph.add_node("orders", orders_agent)
    graph.add_node("radiology", radiology_agent)
    graph.add_node("synthesis", synthesis_agent)

    graph.set_entry_point("intake")
    graph.add_edge("intake", "triage")
    graph.add_conditional_edges(
        "triage",
        _esi_router,
        {
            "resuscitation": "synthesis",
            "standard": "history",
        },
    )
    graph.add_edge("history", "orders")
    graph.add_edge("orders", "radiology")
    graph.add_edge("radiology", "synthesis")
    graph.add_edge("synthesis", END)

    app = graph.compile(
        checkpointer=checkpointer,
        interrupt_before=["radiology", "synthesis"],
    )
    return app, checkpointer


# Module-level singleton for the API to import
_app = None
_checkpointer = None


def get_graph():
    global _app, _checkpointer
    if _app is None:
        _app, _checkpointer = build_graph()
    return _app, _checkpointer
