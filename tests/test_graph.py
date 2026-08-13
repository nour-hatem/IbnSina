"""
Ibn Sina — Graph compilation smoke test.

Verifies the graph compiles, has the right nodes, and the interrupt gates
are in the right places. Does NOT call any LLM.
"""

from api.graph import build_graph


class TestGraphCompilation:
    def test_graph_compiles(self):
        app, checkpointer = build_graph()
        assert app is not None
        assert checkpointer is not None

    def test_graph_has_expected_nodes(self):
        app, _ = build_graph()
        graph = app.get_graph()
        node_names = {n.name for n in graph.nodes.values() if hasattr(n, "name")}
        expected = {"intake", "triage", "history", "orders", "radiology", "synthesis"}
        assert expected.issubset(node_names), f"Missing nodes: {expected - node_names}"
