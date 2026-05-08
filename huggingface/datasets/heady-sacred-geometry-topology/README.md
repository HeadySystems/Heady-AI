---
language:
- en
license: apache-2.0
task_categories:
- graph-ml
- text-retrieval
- tabular-classification
task_ids:
- node-classification
- link-prediction
- graph-regression
tags:
- sacred-geometry
- topology
- phi-math
- heady-ecosystem
- bee-swarm
- graph-data
- routing
- pipeline-stages
size_categories:
- 10K<n<100K
---

# heady-sacred-geometry-topology

**Sacred Geometry node topology data for the HeadySystems routing and swarm coordination infrastructure.**

> Node placement coordinates, routing tables, tier vectors, swarm coordination patterns, and pipeline stage configurations — the structural substrate of the Heady Sacred Geometry (SG) knowledge graph.

## Dataset Description

`heady-sacred-geometry-topology` encodes the geometric and topological structure underlying HeadyConductor's routing layer. The Heady system uses Sacred Geometry as a metaphorical and mathematical framework for organizing knowledge nodes, pipeline stages, and agent swarm positions — each mapped to specific angular and radial positions in phi-scaled coordinate space.

This dataset provides:
- **Node topology**: Position, tier, connectivity, and vector representation of every SG node
- **Routing tables**: Which nodes route to which pipeline stages, under what CSL gate conditions
- **Tier vectors**: 384D embedding prototypes for each SG tier (used by `heady-embeddings-384d`)
- **Swarm patterns**: Agent coordination configurations based on golden-angle spacing
- **Pipeline stage configs**: Stage definitions with phi-scaled capacity and timeout parameters

| Property | Value |
|---|---|
| Total records | **14,382** |
| Node types | 6 Sacred Geometry archetypes |
| Tier levels | 7 |
| Swarm configurations | 144 |
| Pipeline stage configs | 52 |
| Coordinate system | Polar (r, θ) with φ-scaling |
| License | Apache-2.0 |

## Sacred Geometry Archetypes

The Heady topology is built from 6 canonical Sacred Geometry forms, each associated with a routing function:

| Archetype | Symbol | Routing Role | Tier Range | Node Count |
|---|---|---|---|---|
| **Metatron's Cube** | ✦ | Central orchestration, all-to-all routing hub | 1 | 13 |
| **Flower of Life** | ⊛ | Distributed knowledge storage, retrieval nodes | 2–3 | 61 |
| **Vesica Piscis** | ⊃⊂ | Semantic bridge nodes, cross-domain routing | 2–4 | 34 |
| **Merkaba** | ✡ | Transformation nodes, embedding / re-embedding | 3–5 | 48 |
| **Sri Yantra** | ◭ | Deep reasoning nodes, multi-hop traversal | 4–6 | 27 |
| **Torus** | ⊙ | Feedback and loop handling, recursive pipelines | 5–7 | 19 |
| **Total** | | | | **202 nodes** |

### Phi-Scaled Coordinate System

Node positions are encoded in polar coordinates scaled to φ:

```
r_k = φ^(tier_k / 7) × base_radius     (radial distance, phi-exponent scaled)
θ_k = k × 137.5077640°                  (angular position, golden angle)
```

Where `137.5077640°` is the **golden angle** = `360° × (1 - φ⁻¹)` — the angle that produces maximally uniform angular distribution for any number of nodes k.

## Dataset Structure

### Splits

| Split | Records | Contents |
|---|---|---|
| `train` | 11,506 | Full topology + routing tables + swarm configs |
| `validation` | 1,438 | Held-out routing scenarios |
| `test` | 1,438 | Hard routing cases, adversarial swarm configs |

### Configurations

#### `node_topology` — Node placement and connectivity

```python
{
    "node_id": str,             # e.g., "metatron-center", "flower-tier2-023"
    "archetype": str,           # "metatron" | "flower" | "vesica" | "merkaba" | "sri_yantra" | "torus"
    "tier": int,                # 1–7
    "position_r": float,        # Radial coordinate (phi-scaled)
    "position_theta": float,    # Angular coordinate (degrees, 0–360)
    "position_x": float,        # Cartesian x (derived)
    "position_y": float,        # Cartesian y (derived)
    "tier_vector": list[float], # 384D prototype embedding for this node's tier
    "connected_nodes": list[str],  # IDs of directly connected nodes
    "routing_intents": list[str],  # CSL intent labels this node handles
    "capacity": float,          # φ^tier normalized capacity (0–1)
    "latency_ms": float,        # Expected routing latency
    "metadata": {
        "description": str,
        "phi_constant": float,  # φ^(tier/7) for this node
        "golden_index": int,    # k in the golden angle sequence
    }
}
```

#### `routing_tables` — Intent → node routing rules

```python
{
    "intent": str,              # HeadyConductor intent label
    "primary_node": str,        # Default routing target node
    "fallback_nodes": list[str],  # Ordered fallback chain
    "csl_gate": str,            # CSL expression for routing condition
    "tier_constraint": str,     # "min_tier:2" | "exact_tier:1" | "any"
    "load_balance": str,        # "phi_weighted" | "round_robin" | "nearest"
    "timeout_ms": int,          # φ^tier × 100ms
    "retry_policy": {
        "max_retries": int,     # ⌊φ²⌋ = 2
        "backoff_base_ms": int, # 100 × φ = 162ms
    }
}
```

#### `swarm_configurations` — Agent swarm coordination patterns

```python
{
    "config_id": str,
    "swarm_size": int,            # Number of agents (Fibonacci: 3,5,8,13,21,34,55,89...)
    "formation": str,             # "spiral" | "ring" | "cluster" | "cascade"
    "angular_spacing": float,     # Degrees between agents (multiple of golden angle)
    "radial_tiers": list[int],    # Which tiers agents occupy
    "coordination_protocol": str, # "consensus" | "leader_follower" | "stigmergy"
    "phi_scaling_factor": float,  # φ^n scaling applied to formation
    "task_distribution": dict,    # {intent: agent_count} allocation
    "convergence_threshold": float,  # CSL coherence score for swarm agreement
}
```

#### `pipeline_stage_configs` — Stage definitions with phi-scaled parameters

```python
{
    "stage_id": str,           # e.g., "embed_request", "semantic_search"
    "stage_name": str,
    "primary_archetype": str,  # SG archetype responsible for this stage
    "tier": int,               # SG tier this stage operates at
    "phi_capacity": float,     # φ^tier × max_throughput (requests/sec)
    "timeout_ms": int,         # ⌊φ^tier × 500⌋ ms
    "embedding_dim": int,      # 384 (all stages use heady-embeddings-384d)
    "csl_gate_required": str,  # Minimum CSL gate score to activate
    "upstream_stages": list[str],
    "downstream_stages": list[str],
    "scaling_policy": {
        "min_replicas": int,   # Fibonacci sequence value
        "max_replicas": int,   # Next Fibonacci number
        "scale_metric": str,   # "csl_throughput" | "queue_depth" | "latency"
    }
}
```

## Key Topology Constants

All geometry in this dataset is grounded in phi-math:

```python
# Core phi constants
PHI = 1.6180339887498948     # Golden ratio
PHI_INV = 0.6180339887498949 # φ⁻¹ = φ - 1
PHI_SQ = 2.618033988749895   # φ²
GOLDEN_ANGLE = 137.50776405  # Degrees: 360° × (1 - φ⁻¹)
GOLDEN_ANGLE_RAD = 2.3999632 # Radians

# Tier radii (r_k = φ^(k/7) × 100)
TIER_RADII = {
    1: 100.000,   # φ^(1/7) × 100 = 107.18...  → Metatron center
    2: 114.870,   # φ^(2/7) × 100
    3: 123.114,   # φ^(3/7) × 100
    4: 131.951,   # φ^(4/7) × 100
    5: 141.421,   # φ^(5/7) × 100 (= 100√2, coincidence with √2)
    6: 151.572,   # φ^(6/7) × 100
    7: 161.803,   # φ^(7/7) × 100 = φ × 100 = 161.80...
}

# Fibonacci node counts per tier
NODE_COUNTS = {1: 1, 2: 3, 3: 5, 4: 8, 5: 13, 6: 21, 7: 34}  # sum = 85 (base)

# Phi-scaled timeouts (ms) per tier
TIMEOUTS_MS = {t: int(PHI**t * 500) for t in range(1, 8)}
# {1: 809, 2: 1309, 3: 2118, 4: 3427, 5: 5545, 6: 8972, 7: 14517}
```

## How to Use

### Installation

```bash
pip install datasets networkx numpy matplotlib
```

### Load Node Topology

```python
from datasets import load_dataset
import numpy as np

dataset = load_dataset("HeadySystems/heady-sacred-geometry-topology", "node_topology")

nodes = dataset["train"]

# Filter Metatron nodes (Tier 1 — central orchestration)
metatron = nodes.filter(lambda x: x["archetype"] == "metatron")
print(f"Metatron nodes: {len(metatron)}")

# Get all tier vectors for embedding model initialization
tier_vectors = {}
for node in nodes:
    tier = node["tier"]
    if tier not in tier_vectors:
        tier_vectors[tier] = []
    tier_vectors[tier].append(node["tier_vector"])

# Compute tier centroids (used as prototype initializations)
tier_centroids = {
    tier: np.mean(vecs, axis=0)
    for tier, vecs in tier_vectors.items()
}
```

### Build Graph with NetworkX

```python
from datasets import load_dataset
import networkx as nx

dataset = load_dataset("HeadySystems/heady-sacred-geometry-topology", "node_topology")

G = nx.Graph()
for node in dataset["train"]:
    G.add_node(
        node["node_id"],
        archetype=node["archetype"],
        tier=node["tier"],
        pos=(node["position_x"], node["position_y"]),
        capacity=node["capacity"]
    )
    for neighbor in node["connected_nodes"]:
        G.add_edge(node["node_id"], neighbor)

print(f"Nodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}")

# Find shortest routing path (Metatron → Torus)
metatron_node = "metatron-center"
torus_nodes = [n for n, d in G.nodes(data=True) if d["archetype"] == "torus"]
for torus in torus_nodes[:3]:
    path = nx.shortest_path(G, metatron_node, torus)
    print(f"Route to {torus}: {' → '.join(path)}")
```

### Visualize Golden Angle Spiral Placement

```python
import numpy as np
import matplotlib.pyplot as plt
from datasets import load_dataset

dataset = load_dataset("HeadySystems/heady-sacred-geometry-topology", "node_topology")

PHI = 1.6180339887
GOLDEN_ANGLE = 137.50776405

fig, ax = plt.subplots(1, 1, figsize=(10, 10))

archetype_colors = {
    "metatron": "#FFD700",    # Gold
    "flower": "#00CED1",      # Teal
    "vesica": "#9370DB",      # Purple
    "merkaba": "#FF6347",     # Tomato
    "sri_yantra": "#3CB371",  # Green
    "torus": "#FF8C00",       # Dark orange
}

for node in dataset["train"]:
    color = archetype_colors.get(node["archetype"], "#888888")
    size = PHI ** node["tier"] * 20
    ax.scatter(
        node["position_x"], node["position_y"],
        c=color, s=size, alpha=0.8, zorder=5
    )

ax.set_title("HeadySystems Sacred Geometry Node Topology\n(phi-scaled, golden-angle spacing)")
ax.set_aspect("equal")
plt.tight_layout()
plt.savefig("sg_topology.png", dpi=150)
```

### Simulate Swarm Coordination

```python
from datasets import load_dataset
import numpy as np

PHI = 1.6180339887
GOLDEN_ANGLE_RAD = 2.3999632

dataset = load_dataset("HeadySystems/heady-sacred-geometry-topology", "swarm_configurations")

for config in dataset["train"].filter(lambda x: x["formation"] == "spiral"):
    n = config["swarm_size"]
    # Fibonacci swarm: place n agents on golden angle spiral
    angles = np.arange(n) * GOLDEN_ANGLE_RAD
    radii = PHI ** (np.arange(n) / n) * config["phi_scaling_factor"]
    x = radii * np.cos(angles)
    y = radii * np.sin(angles)
    print(f"Swarm {config['config_id']}: {n} agents, formation=spiral")
    print(f"  Angular coverage: {np.degrees(angles[-1] - angles[0]):.1f}°")
    print(f"  Convergence threshold: {config['convergence_threshold']:.4f}")
    break
```

## Dataset Statistics

### Node Degree Distribution

| Degree | Node count | Archetype skew |
|---|---|---|
| 1–3 (leaf) | 47 | Torus, Sri Yantra periphery |
| 4–8 (mid) | 89 | Merkaba, Vesica bridge nodes |
| 9–16 (hub) | 52 | Flower of Life tier 2–3 |
| 17–30 (super-hub) | 11 | Flower tier 1, Vesica centers |
| 31+ (orchestrator) | 3 | Metatron's Cube (all 13 nodes) |

### Phi-Capacity Distribution

Capacities follow a phi-log-normal distribution (mean = φ⁻¹ = 0.618, σ = 0.13):
- Tier 1 nodes: capacity = 1.0 (Metatron, full routing)
- Tier 7 nodes: capacity = φ⁻⁶ ≈ 0.056 (deep reasoning, high latency)

## Limitations

- **Metaphorical geometry**: Sacred Geometry positions are symbolic coordinate mappings, not physical locations. Euclidean distance in this dataset is meaningful for routing priority but not for physical deployment.
- **Swarm configs are templates**: The 144 swarm configurations are archetypal patterns; production deployments will adapt them based on load.
- **Tier vector staleness**: Tier vectors are generated from a fixed snapshot of `heady-embeddings-384d`; regenerate if the embedding model is updated.
- **No temporal dynamics**: This dataset captures a static topology snapshot. Dynamic node addition/removal is not modeled.

## Citation

```bibtex
@misc{headysystems2025sgtopology,
  author       = {{HeadySystems Inc.}},
  title        = {heady-sacred-geometry-topology: Phi-Scaled Node Topology and Swarm Coordination Data},
  year         = {2025},
  howpublished = {\url{https://huggingface.co/datasets/HeadySystems/heady-sacred-geometry-topology}},
  note         = {14,382 records covering Sacred Geometry node placement, routing tables, and swarm configurations}
}
```

## License

Apache-2.0. See [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) for details.

---
*Built with care by [HeadySystems Inc.](https://huggingface.co/HeadySystems) — Intelligent infrastructure for the next generation of knowledge systems.*
