"""
Capability Graph — Extended graph operations for the capability knowledge graph.
Provides traversal, clustering, and insight extraction.
"""

from typing import Any
from graph.graphify import build_graph, get_graph_stats


def find_capability_clusters(graph: dict[str, Any]) -> list[dict[str, Any]]:
    """Find clusters of closely related capabilities in the graph."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    # Build adjacency map
    adj: dict[str, set[str]] = {}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        adj.setdefault(src, set()).add(tgt)
        adj.setdefault(tgt, set()).add(src)

    # Find capability nodes
    cap_nodes = [n for n in nodes if n.get("type") == "capability"]

    # Simple clustering: group capabilities that share repo neighbors
    clusters = []
    visited = set()

    for cap in cap_nodes:
        cap_id = cap.get("id", "")
        if cap_id in visited:
            continue

        # BFS to find connected capability nodes
        cluster = [cap]
        visited.add(cap_id)
        queue = [cap_id]

        while queue:
            current = queue.pop(0)
            for neighbor in adj.get(current, set()):
                neighbor_node = next((n for n in nodes if n.get("id") == neighbor), None)
                if neighbor_node and neighbor_node.get("type") == "capability" and neighbor not in visited:
                    visited.add(neighbor)
                    cluster.append(neighbor_node)
                    queue.append(neighbor)

        if len(cluster) > 1:
            clusters.append({
                "name": " + ".join(c.get("label", "") for c in cluster),
                "capabilities": [c.get("capability", "") for c in cluster],
                "size": len(cluster),
            })

    return clusters


def find_product_opportunities(graph: dict[str, Any]) -> list[dict[str, Any]]:
    """Identify product opportunities based on graph structure."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    # Find repo nodes with many capability connections (high-value repos)
    repo_nodes = [n for n in nodes if n.get("type") == "repo"]
    repo_connections: dict[str, int] = {}
    for edge in edges:
        if edge.get("type") == "has":
            src = edge.get("source", "")
            repo_connections[src] = repo_connections.get(src, 0) + 1

    high_value_repos = sorted(
        [n for n in repo_nodes if repo_connections.get(n.get("id", ""), 0) >= 2],
        key=lambda n: repo_connections.get(n.get("id", ""), 0),
        reverse=True,
    )

    # Find capability gaps (capabilities not connected to any product)
    product_nodes = [n for n in nodes if n.get("type") == "product"]
    product_caps = set()
    for edge in edges:
        if edge.get("type") == "builds":
            product_caps.add(edge.get("source", ""))

    cap_nodes = [n for n in nodes if n.get("type") == "capability"]
    unattached_caps = [c for c in cap_nodes if c.get("id") not in product_caps]

    opportunities = []
    if high_value_repos:
        opportunities.append({
            "type": "high_value_repo",
            "description": f"Repo '{high_value_repos[0].get('label', '')}' has {repo_connections.get(high_value_repos[0].get('id', ''), 0)} capabilities — ideal for product composition",
            "repos": [r.get("full_name", "") for r in high_value_repos[:3]],
        })

    if unattached_caps:
        opportunities.append({
            "type": "unused_capability",
            "description": f"Capabilities {', '.join(c.get('label', '') for c in unattached_caps)} are not yet composed into any product",
            "capabilities": [c.get("capability", "") for c in unattached_caps],
        })

    return opportunities
