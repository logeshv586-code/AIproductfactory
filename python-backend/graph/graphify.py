"""
Graphify — Knowledge Graph Builder
Converts Repos → Capabilities → Relationships → Products as a graph
with typed nodes and labeled edges for visualization.
"""

from typing import Any
import uuid


# Node types with their visual properties
NODE_TYPES = {
    "repo": {"color": "#8b5cf6", "icon": "Github"},        # Purple
    "capability": {"color": "#14b8a6", "icon": "Zap"},      # Teal
    "product": {"color": "#f59e0b", "icon": "Rocket"},      # Amber
}

# Edge types with their labels
EDGE_TYPES = {
    "has": {"label": "has", "color": "#94a3b8"},            # Slate
    "builds": {"label": "builds", "color": "#22c55e"},      # Green
    "requires": {"label": "requires", "color": "#ef4444"},   # Red
    "enables": {"label": "enables", "color": "#3b82f6"},     # Blue
    "composes": {"label": "composes", "color": "#f97316"},   # Orange
}


def build_graph(
    repos: list[dict[str, Any]],
    capabilities: list[dict[str, Any]],
    products: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Build a knowledge graph from repos, capabilities, and products.

    Returns:
      - nodes: List of graph nodes with id, label, type, and properties
      - edges: List of graph edges with source, target, label, and properties
    """
    nodes = []
    edges = []

    # Track node IDs to avoid duplicates
    node_ids = set()

    # ── Create Repo Nodes ────────────────────────────────────────────────
    repo_node_map = {}  # repo_name → node_id
    for repo in repos:
        name = repo.get("full_name", repo.get("name", ""))
        node_id = f"repo_{_safe_id(name)}"
        if node_id not in node_ids:
            node_ids.add(node_id)
            repo_node_map[name] = node_id
            nodes.append({
                "id": node_id,
                "label": repo.get("name", name.split("/")[-1]),
                "type": "repo",
                "full_name": name,
                "description": repo.get("description", ""),
                "stars": repo.get("stars", 0),
                "language": repo.get("language", ""),
                "color": NODE_TYPES["repo"]["color"],
                "icon": NODE_TYPES["repo"]["icon"],
            })

    # ── Create Capability Nodes ──────────────────────────────────────────
    cap_node_map = {}  # capability_type → node_id
    for cap in capabilities:
        cap_type = cap.get("capability", "general")
        node_id = f"cap_{cap_type}"
        if node_id not in node_ids:
            node_ids.add(node_id)
            cap_node_map[cap_type] = node_id
            nodes.append({
                "id": node_id,
                "label": cap_type.title(),
                "type": "capability",
                "capability": cap_type,
                "confidence": cap.get("confidence", 0.5),
                "color": NODE_TYPES["capability"]["color"],
                "icon": NODE_TYPES["capability"]["icon"],
            })

    # ── Create Product Nodes ─────────────────────────────────────────────
    product_node_map = {}  # product_name → node_id
    for product in products:
        name = product.get("name", "")
        node_id = f"prod_{_safe_id(name)}"
        if node_id not in node_ids:
            node_ids.add(node_id)
            product_node_map[name] = node_id

            scores = product.get("scores", {})
            nodes.append({
                "id": node_id,
                "label": name,
                "type": "product",
                "description": product.get("description", ""),
                "score": scores.get("final_score", 0),
                "color": NODE_TYPES["product"]["color"],
                "icon": NODE_TYPES["product"]["icon"],
            })

    # ── Create Edges: Repo → Capability ──────────────────────────────────
    edge_ids = set()
    for cap in capabilities:
        repo_name = cap.get("repo", cap.get("full_name", cap.get("name", "")))
        cap_type = cap.get("capability", "general")

        repo_node_id = repo_node_map.get(repo_name)
        cap_node_id = cap_node_map.get(cap_type)

        if repo_node_id and cap_node_id:
            edge_id = f"e_{repo_node_id}_has_{cap_node_id}"
            if edge_id not in edge_ids:
                edge_ids.add(edge_id)
                edges.append({
                    "id": edge_id,
                    "source": repo_node_id,
                    "target": cap_node_id,
                    "label": "has",
                    "type": "has",
                    "color": EDGE_TYPES["has"]["color"],
                    "animated": False,
                })

    # ── Create Edges: Capability → Product ───────────────────────────────
    for product in products:
        product_name = product.get("name", "")
        product_node_id = product_node_map.get(product_name)

        if not product_node_id:
            continue

        for cap_type in product.get("capabilities", []):
            cap_node_id = cap_node_map.get(cap_type)
            if cap_node_id:
                edge_id = f"e_{cap_node_id}_builds_{product_node_id}"
                if edge_id not in edge_ids:
                    edge_ids.add(edge_id)
                    edges.append({
                        "id": edge_id,
                        "source": cap_node_id,
                        "target": product_node_id,
                        "label": "builds",
                        "type": "builds",
                        "color": EDGE_TYPES["builds"]["color"],
                        "animated": True,
                    })

    # ── Create Edges: Product → Product dependencies ─────────────────────
    # Products that share capabilities are connected
    for i, product_a in enumerate(products):
        for product_b in products[i+1:]:
            shared = set(product_a.get("capabilities", [])) & set(product_b.get("capabilities", []))
            if shared:
                a_id = product_node_map.get(product_a.get("name", ""))
                b_id = product_node_map.get(product_b.get("name", ""))
                if a_id and b_id:
                    edge_id = f"e_{a_id}_composes_{b_id}"
                    if edge_id not in edge_ids:
                        edge_ids.add(edge_id)
                        edges.append({
                            "id": edge_id,
                            "source": a_id,
                            "target": b_id,
                            "label": f"shares: {','.join(shared)}",
                            "type": "composes",
                            "color": EDGE_TYPES["composes"]["color"],
                            "animated": False,
                        })

    # ── Create Edges: Product → Required capabilities (if not yet present) ─
    for product in products:
        product_name = product.get("name", "")
        product_node_id = product_node_map.get(product_name)

        if not product_node_id:
            continue

        for cap_type in product.get("capabilities", []):
            cap_node_id = cap_node_map.get(cap_type)
            if not cap_node_id:
                # Create missing capability node
                new_cap_id = f"cap_{cap_type}"
                if new_cap_id not in node_ids:
                    node_ids.add(new_cap_id)
                    cap_node_map[cap_type] = new_cap_id
                    nodes.append({
                        "id": new_cap_id,
                        "label": cap_type.title(),
                        "type": "capability",
                        "capability": cap_type,
                        "confidence": 0.3,
                        "color": NODE_TYPES["capability"]["color"],
                        "icon": NODE_TYPES["capability"]["icon"],
                    })

                edge_id = f"e_{product_node_id}_requires_{new_cap_id}"
                if edge_id not in edge_ids:
                    edge_ids.add(edge_id)
                    edges.append({
                        "id": edge_id,
                        "source": product_node_id,
                        "target": new_cap_id,
                        "label": "requires",
                        "type": "requires",
                        "color": EDGE_TYPES["requires"]["color"],
                        "animated": False,
                    })

    print(f"[Graphify] Built graph: {len(nodes)} nodes, {len(edges)} edges")
    return {
        "nodes": nodes,
        "edges": edges,
    }


def _safe_id(text: str) -> str:
    """Convert text to a safe graph node ID."""
    return text.lower().replace(" ", "_").replace("/", "_").replace("-", "_").replace(".", "_")[:50]


def get_graph_stats(graph: dict[str, Any]) -> dict[str, Any]:
    """Get summary statistics about a graph."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node_types = {}
    for node in nodes:
        ntype = node.get("type", "unknown")
        node_types[ntype] = node_types.get(ntype, 0) + 1

    edge_types = {}
    for edge in edges:
        etype = edge.get("type", "unknown")
        edge_types[etype] = edge_types.get(etype, 0) + 1

    return {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "node_types": node_types,
        "edge_types": edge_types,
    }
