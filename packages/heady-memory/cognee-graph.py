# packages/heady-memory/cognee-graph.py
# Extracted from topoteretes/cognee (Apache 2.0)
# Builds persistent knowledge graph from user interactions
#
# HEADY_BRAND:BEGIN
# © 2026 HeadySystems Inc. — Cognee Knowledge Graph Integration
# HEADY_BRAND:END

"""
Cognee ECL Pipeline — Extract → Cognify → Memify → Search
Builds a live knowledge graph from all user interactions.

Requirements:
    pip install cognee qdrant-client neo4j

Configuration (env vars):
    OPENAI_API_KEY       — LLM for extraction
    QDRANT_URL           — Vector store endpoint
    QDRANT_API_KEY       — Qdrant auth
    NEO4J_URL            — Graph DB endpoint (bolt://...)
    NEO4J_PASSWORD       — Graph DB auth
"""

import os
import asyncio
import json
import sys

try:
    import cognee
    from cognee import SearchType
    HAS_COGNEE = True
except ImportError:
    HAS_COGNEE = False


def configure_cognee():
    """Configure Cognee to use Heady's production infrastructure."""
    if not HAS_COGNEE:
        raise ImportError("cognee is not installed. Run: pip install cognee")

    cognee.config.set_llm_config({
        "provider": "openai",
        "model": os.environ.get("COGNEE_MODEL", "gpt-4.1"),
        "api_key": os.environ["OPENAI_API_KEY"],
    })

    # Use Qdrant for vector storage (instead of default LanceDB)
    qdrant_url = os.environ.get("QDRANT_URL", "https://qdrant.headysystems.com")
    qdrant_key = os.environ.get("QDRANT_API_KEY", "")
    if qdrant_url and qdrant_key:
        cognee.config.set_vector_db_config({
            "provider": "qdrant",
            "url": qdrant_url,
            "api_key": qdrant_key,
        })

    # Use Neo4j for graph storage (production scale)
    neo4j_url = os.environ.get("NEO4J_URL", "")
    neo4j_password = os.environ.get("NEO4J_PASSWORD", "")
    if neo4j_url and neo4j_password:
        cognee.config.set_graph_db_config({
            "provider": "neo4j",
            "url": neo4j_url,
            "username": "neo4j",
            "password": neo4j_password,
        })


async def ingest_interaction(user_id: str, content: str, dataset: str = None):
    """Add an interaction to the user's knowledge graph."""
    configure_cognee()
    dataset_name = dataset or f"user_{user_id}"

    await cognee.add(content, dataset_name=dataset_name)
    await cognee.cognify(datasets=[dataset_name])  # builds knowledge graph

    # memify adds rule extraction — crucial for HeadyPatterns
    try:
        await cognee.memify(dataset=dataset_name)
    except Exception:
        pass  # memify is optional — some Cognee versions don't have it


async def query_knowledge(user_id: str, query: str, search_type: str = "GRAPH_COMPLETION"):
    """Query the user's knowledge graph."""
    configure_cognee()
    results = await cognee.search(
        query_type=SearchType[search_type],
        query_text=query,
    )
    return results


async def get_coding_rules(user_id: str):
    """Extract coding patterns — feeds into HeadyPatterns node."""
    configure_cognee()
    try:
        return await cognee.search(
            query_type=SearchType.CODING_RULES,
            query_text="List all coding rules and patterns",
            node_name=["coding_agent_rules"],
        )
    except (AttributeError, KeyError):
        # Fallback if CODING_RULES search type not available
        return await cognee.search(
            query_type=SearchType.GRAPH_COMPLETION,
            query_text="List all coding rules and patterns",
        )


# ─── CLI Bridge (for Node.js interop via child_process or gRPC) ───

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = json.loads(sys.argv[1])
    else:
        cmd = json.loads(sys.stdin.read())

    action = cmd.get("action", "query")

    if action == "ingest":
        asyncio.run(ingest_interaction(cmd["userId"], cmd["content"]))
        print(json.dumps({"status": "ok"}))

    elif action == "query":
        results = asyncio.run(query_knowledge(cmd["userId"], cmd["query"]))
        print(json.dumps(results, default=str))

    elif action == "rules":
        results = asyncio.run(get_coding_rules(cmd["userId"]))
        print(json.dumps(results, default=str))

    else:
        print(json.dumps({"error": f"Unknown action: {action}"}))
        sys.exit(1)
