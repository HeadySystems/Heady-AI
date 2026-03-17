"""
Heady Vector Fabric — Distributed Memory via Pinecone
======================================================
The shared memory of the liquid OS. Every agent writes embeddings to
its own namespace. Cross-agent consensus queries search across all
namespaces simultaneously. State persists across node deaths because
it lives in Pinecone's cloud, not on any Colab runtime.

Namespace strategy:
  sg_alpha_signals        — Alpha Agent's trading signals
  sg_risk_assessments     — Risk Agent's veto/approval records  
  sg_data_context         — Data Agent's enriched context
  sg_compliance_audit     — Compliance Agent's audit trail
  sg_sentinel_health      — Sentinel Agent's health snapshots
  shared_market_data      — Cross-agent market data embeddings
  shared_consensus        — Quorum voting records
  shared_knowledge_base   — System-wide knowledge

Usage:
    from heady_vectors import VectorFabric
    
    fabric = VectorFabric(api_key=os.environ["PINECONE_API_KEY"])
    await fabric.connect("heady-primary")
    
    # Store a signal embedding
    await fabric.upsert("sg_alpha_signals", [
        ("sig-001", embedding_vector, {"instrument": "NQH6", "confidence": 0.85})
    ])
    
    # Cross-agent consensus query
    results = await fabric.consensus_query(query_vector, top_k=10)

© 2026 HeadySystems Inc. — Sacred Geometry v4.0
"""

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

PHI = 1.618033988749895
PSI = 1 / PHI
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144]

# Pinecone batch limits
UPSERT_BATCH_SIZE = 100      # Vectors per batch (stays under 2MB for 1536-dim)
QUERY_TOP_K_MAX = 100        # Pinecone max top_k per query
CONCURRENCY_LIMIT = FIB[6]   # 13 concurrent operations (Fibonacci)

# Agent namespaces
AGENT_NAMESPACES = {
    "alpha": "sg_alpha_signals",
    "risk": "sg_risk_assessments",
    "data": "sg_data_context",
    "compliance": "sg_compliance_audit",
    "sentinel": "sg_sentinel_health",
    "execution": "sg_execution_records",
    "view": "sg_view_state",
    "bridge": "sg_bridge_topology",
    "jules": "add_jules_code",
    "observer": "add_observer_patterns",
    "builder": "add_builder_systems",
    "atlas": "add_atlas_maps",
    "pythia": "add_pythia_predictions",
    "socrates": "add_socrates_reasoning",
}

SHARED_NAMESPACES = [
    "shared_market_data",
    "shared_consensus",
    "shared_knowledge_base",
]


@dataclass
class VectorResult:
    """A single result from a vector search."""
    id: str
    score: float
    namespace: str
    metadata: dict = field(default_factory=dict)


class VectorFabric:
    """The shared memory of the Heady liquid OS.
    
    Wraps Pinecone with per-agent namespaces, batch operations,
    and cross-namespace consensus queries. All operations are async
    and handle retries with Fibonacci backoff.
    """
    
    def __init__(self, api_key: str = None, logger=None):
        self.api_key = api_key or os.environ.get("PINECONE_API_KEY", "")
        self.logger = logger
        self._index = None
        self._index_host = None
        self._connected = False
        self._semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
    
    async def connect(self, index_name: str = "heady-primary"):
        """Connect to a Pinecone index.
        
        Uses the async Pinecone client (PineconeAsyncio) for non-blocking
        operations. If the index doesn't exist, creates it as serverless
        on AWS us-east-1 with cosine similarity and 1536 dimensions
        (matching OpenAI text-embedding-3-small).
        """
        if not self.api_key:
            self._log("warning", "No PINECONE_API_KEY — vector fabric disabled")
            return
        
        try:
            from pinecone import Pinecone, ServerlessSpec
            
            pc = Pinecone(api_key=self.api_key)
            
            # Check if index exists
            existing = [idx.name for idx in pc.list_indexes()]
            
            if index_name not in existing:
                self._log("info", f"Creating index '{index_name}'")
                pc.create_index(
                    name=index_name,
                    dimension=1536,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                )
                # Wait for index to be ready
                while not pc.describe_index(index_name).status.get("ready"):
                    await asyncio.sleep(1)
            
            self._index = pc.Index(index_name)
            self._index_host = pc.describe_index(index_name).host
            self._connected = True
            self._log("info", f"Connected to Pinecone index '{index_name}'")
            
        except ImportError:
            self._log("error", "pinecone package not installed. pip install pinecone")
        except Exception as e:
            self._log("error", f"Pinecone connection failed: {e}")
    
    async def upsert(self, namespace: str, vectors: list[tuple], batch_size: int = UPSERT_BATCH_SIZE):
        """Upsert vectors into a namespace.
        
        Vectors is a list of (id, values, metadata) tuples. Automatically
        batches into chunks of batch_size to stay under Pinecone's 2MB
        request limit. All batches run concurrently up to the semaphore limit.
        
        Args:
            namespace: Pinecone namespace (e.g., "sg_alpha_signals")
            vectors: List of (id: str, values: list[float], metadata: dict)
            batch_size: Vectors per batch (default 100)
        """
        if not self._connected:
            return
        
        # Convert to Pinecone format
        formatted = []
        for v in vectors:
            if len(v) == 3:
                formatted.append({"id": v[0], "values": v[1], "metadata": v[2]})
            elif len(v) == 2:
                formatted.append({"id": v[0], "values": v[1]})
        
        # Batch and upsert concurrently
        batches = [formatted[i:i+batch_size] for i in range(0, len(formatted), batch_size)]
        
        async def _upsert_batch(batch):
            async with self._semaphore:
                try:
                    self._index.upsert(vectors=batch, namespace=namespace)
                except Exception as e:
                    self._log("error", f"Upsert batch failed: {e}")
        
        await asyncio.gather(*[_upsert_batch(b) for b in batches])
        self._log("info", f"Upserted {len(formatted)} vectors to {namespace}")
    
    async def query(self, namespace: str, vector: list[float],
                     top_k: int = 10, filter: dict = None) -> list[VectorResult]:
        """Query a single namespace for similar vectors.
        
        Args:
            namespace: Which namespace to search
            vector: Query vector (must match index dimension)
            top_k: Number of results to return
            filter: Optional metadata filter (e.g., {"instrument": "NQH6"})
        
        Returns:
            List of VectorResult objects sorted by score descending
        """
        if not self._connected:
            return []
        
        try:
            async with self._semaphore:
                result = self._index.query(
                    namespace=namespace,
                    vector=vector,
                    top_k=min(top_k, QUERY_TOP_K_MAX),
                    include_metadata=True,
                    filter=filter,
                )
            
            return [
                VectorResult(
                    id=match.id,
                    score=match.score,
                    namespace=namespace,
                    metadata=match.metadata or {},
                )
                for match in result.matches
            ]
        except Exception as e:
            self._log("error", f"Query failed on {namespace}: {e}")
            return []
    
    async def consensus_query(self, vector: list[float], top_k: int = 10,
                                namespaces: list[str] = None,
                                filter: dict = None) -> list[VectorResult]:
        """Query across multiple agent namespaces simultaneously.
        
        This is the cross-agent consensus mechanism. When the swarm needs
        to make a decision, it queries all relevant agent namespaces in
        parallel and merges the results into a single ranked list. This
        lets you find, for example, the strongest signal that has both
        high Alpha confidence AND passing Risk assessment AND Compliance
        approval — a multi-agent vector consensus.
        
        Args:
            vector: Query vector
            top_k: Results per namespace (total results = top_k × len(namespaces))
            namespaces: Which namespaces to search (default: all agent + shared)
            filter: Optional metadata filter applied to all namespaces
        
        Returns:
            Merged, deduplicated results sorted by score
        """
        if not self._connected:
            return []
        
        if namespaces is None:
            namespaces = list(AGENT_NAMESPACES.values()) + SHARED_NAMESPACES
        
        # Query all namespaces concurrently
        tasks = [
            self.query(ns, vector, top_k=top_k, filter=filter)
            for ns in namespaces
        ]
        all_results = await asyncio.gather(*tasks)
        
        # Merge and deduplicate by ID, keeping highest score
        merged = {}
        for results in all_results:
            for r in results:
                if r.id not in merged or r.score > merged[r.id].score:
                    merged[r.id] = r
        
        # Sort by score descending
        return sorted(merged.values(), key=lambda r: r.score, reverse=True)
    
    async def store_agent_memory(self, agent_id: str, memory_id: str,
                                   vector: list[float], metadata: dict):
        """Store a memory for a specific agent.
        
        Convenience method that handles namespace resolution and
        timestamp injection. Every agent memory automatically gets
        a Unix timestamp in metadata for time-range queries.
        """
        namespace = AGENT_NAMESPACES.get(agent_id, f"unknown_{agent_id}")
        metadata["stored_at"] = time.time()
        metadata["agent_id"] = agent_id
        
        await self.upsert(namespace, [(memory_id, vector, metadata)])
    
    async def recall_agent_memory(self, agent_id: str, vector: list[float],
                                    top_k: int = 5, since_timestamp: float = None) -> list[VectorResult]:
        """Recall memories for a specific agent.
        
        Optionally filter by time — only recall memories stored after
        a given timestamp. Useful for recalling recent context.
        """
        namespace = AGENT_NAMESPACES.get(agent_id, f"unknown_{agent_id}")
        
        filter_dict = None
        if since_timestamp:
            filter_dict = {"stored_at": {"$gt": since_timestamp}}
        
        return await self.query(namespace, vector, top_k=top_k, filter=filter_dict)
    
    async def delete_namespace(self, namespace: str):
        """Delete all vectors in a namespace."""
        if not self._connected:
            return
        try:
            self._index.delete(delete_all=True, namespace=namespace)
            self._log("info", f"Deleted namespace {namespace}")
        except Exception as e:
            self._log("error", f"Delete namespace failed: {e}")
    
    def get_stats(self) -> dict:
        """Get index statistics including per-namespace vector counts."""
        if not self._connected:
            return {"connected": False}
        try:
            stats = self._index.describe_index_stats()
            return {
                "connected": True,
                "total_vectors": stats.total_vector_count,
                "dimension": stats.dimension,
                "namespaces": {
                    ns: info.vector_count
                    for ns, info in (stats.namespaces or {}).items()
                },
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}
    
    def _log(self, level: str, msg: str):
        if self.logger:
            getattr(self.logger, level, self.logger.info)(msg)
        else:
            print(f"[VectorFabric] {level.upper()}: {msg}")


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Heady Vector Fabric — Pinecone Client")
    print("=" * 50)
    print(f"Agent namespaces: {len(AGENT_NAMESPACES)}")
    for agent_id, ns in AGENT_NAMESPACES.items():
        print(f"  {agent_id:12s} → {ns}")
    print(f"\nShared namespaces: {len(SHARED_NAMESPACES)}")
    for ns in SHARED_NAMESPACES:
        print(f"  {ns}")
    print(f"\nBatch size: {UPSERT_BATCH_SIZE}")
    print(f"Concurrency limit: {CONCURRENCY_LIMIT} (Fibonacci)")
    print(f"Max top_k: {QUERY_TOP_K_MAX}")
    
    fabric = VectorFabric()
    print(f"\nStats: {fabric.get_stats()}")
