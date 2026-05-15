"""
Graph Memory — Relationship-based storage and reasoning.
Target: Neo4j / Memgraph
"""

from typing import Any, List, Optional

class GraphMemory:
    def __init__(self):
        # Simulated graph storage: nodes and edges
        self.nodes = {} # id -> {label, type, properties}
        self.edges = [] # list of {source, target, label, type}

    def add_node(self, id: str, label: str, type: str, properties: dict[str, Any] = None):
        self.nodes[id] = {
            "id": id,
            "label": label,
            "type": type,
            "properties": properties or {}
        }

    def add_edge(self, source: str, target: str, label: str, type: str):
        if source in self.nodes and target in self.nodes:
            self.edges.append({
                "source": source,
                "target": target,
                "label": label,
                "type": type
            })

    def get_neighbors(self, node_id: str, edge_type: Optional[str] = None) -> List[dict[str, Any]]:
        """Find nodes connected to the given node."""
        neighbors = []
        for edge in self.edges:
            if edge["source"] == node_id:
                if edge_type is None or edge["type"] == edge_type:
                    neighbors.append(self.nodes[edge["target"]])
        return neighbors

    def query_path(self, start_node_id: str, path_pattern: List[str]) -> List[List[dict[str, Any]]]:
        """
        Simple multi-hop path query.
        path_pattern is a list of edge types.
        """
        # Very basic implementation for demo purposes
        paths = [[self.nodes[start_node_id]]]
        for edge_type in path_pattern:
            new_paths = []
            for path in paths:
                last_node = path[-1]
                neighbors = self.get_neighbors(last_node["id"], edge_type)
                for neighbor in neighbors:
                    new_paths.append(path + [neighbor])
            paths = new_paths
        return paths

_graph_memory = None

def get_graph_memory() -> GraphMemory:
    global _graph_memory
    if _graph_memory is None:
        _graph_memory = GraphMemory()
    return _graph_memory
