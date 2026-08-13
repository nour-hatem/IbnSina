"""
Ibn Sina — LangGraph StateGraph wiring.

6 nodes, ESI-based conditional routing, interrupt_before at the two
clinician-approval gates (orders -> radiology, radiology -> synthesis).
"""

from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from api.agents.history import history_agent
from api.agents.intake import intake_agent
from api.agents.orders import orders_agent
from api.agents.radiology import radiology_agent
from api.agents.synthesis import synthesis_agent
from api.agents.triage import triage_agent
from api.schemas import PatientEncounter


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
        checkpointer = MemorySaver()

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
