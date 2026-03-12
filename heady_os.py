"""
Heady Liquid Latent OS
=======================
There is no frontend. There is no backend. There is only the liquid
latent OS — a dynamic async parallel intelligently orchestrated
distributed system that runs across ephemeral compute nodes.

Each Colab runtime boots this OS. The OS detects its environment,
joins the swarm, accepts work, and self-heals. When the runtime dies,
the OS checkpoints and another runtime picks up the work.

This replaces heady_main.py with a liquid-native architecture.

Usage in Colab (one cell):
    !pip install redis pinecone sentry-sdk httpx -q --break-system-packages
    
    import os
    os.environ["REDIS_URL"] = "rediss://default:TOKEN@host:6379"
    os.environ["PINECONE_API_KEY"] = "pcsk_..."
    os.environ["JWT_SECRET"] = "..."
    os.environ["HEADY_NODE"] = "hot-us-east"  # or warm-us-west, cold-eu-west
    
    from heady_os import boot
    await boot()

© 2026 HeadySystems Inc. — Sacred Geometry v4.0
"""

import asyncio
import json
import os
import sys
import time
from typing import Optional

# Local imports
from heady_liquid import LiquidNode, NodeState, PHI, PSI, FIB
from heady_auth import HeadyAuth
from heady_agent_prompts import AGENTS, get_prompt

# ---------------------------------------------------------------------------
# Node → Agent mapping
# ---------------------------------------------------------------------------
# In the liquid OS, there are no "servers" running specific agents.
# Instead, each liquid node runs ALL the agents it has capacity for.
# The node's GPU determines what it CAN run; the swarm determines
# what it SHOULD run based on current colony needs.

NODE_CAPABILITIES = {
    "hot-us-east": {
        "role": "primary",
        "agents": ["bridge", "alpha", "risk", "data", "execution"],
        "domains": [
            "coordination", "topology", "market_data", "signal_generation",
            "risk_assessment", "veto_authority", "data_enrichment",
            "vector_search", "execution", "order_routing",
        ],
        "description": "Primary active node — runs core trading pipeline",
    },
    "warm-us-west": {
        "role": "secondary",
        "agents": ["alpha", "data", "execution", "compliance", "sentinel"],
        "domains": [
            "market_data", "signal_generation", "data_enrichment",
            "vector_search", "execution", "order_routing",
            "compliance", "regulatory", "monitoring", "health_check",
        ],
        "description": "Secondary warm standby — redundant execution path",
    },
    "cold-eu-west": {
        "role": "tertiary",
        "agents": ["sentinel", "compliance", "view", "data"],
        "domains": [
            "monitoring", "health_check", "compliance", "regulatory",
            "rendering", "dashboard", "data_enrichment", "vector_search",
        ],
        "description": "Tertiary cold standby — monitoring and compliance",
    },
}

# Extended agents beyond the Sacred Geometry 8
EXTENDED_AGENTS = {
    "jules": {"domains": ["code_generation", "refactoring"], "description": "Code generation and refactoring agent"},
    "observer": {"domains": ["monitoring", "anomaly_detection"], "description": "Deep observation and pattern recognition"},
    "builder": {"domains": ["system_building", "integration"], "description": "System integration and construction"},
    "atlas": {"domains": ["navigation", "mapping", "routing"], "description": "System navigation and knowledge mapping"},
    "pythia": {"domains": ["prediction", "forecasting"], "description": "Predictive analytics and forecasting"},
    "socrates": {"domains": ["reasoning", "questioning", "analysis"], "description": "Socratic reasoning and deep analysis"},
}


# ---------------------------------------------------------------------------
# Task handlers — the actual work each domain performs
# ---------------------------------------------------------------------------

async def handle_signal_generation(data: dict) -> dict:
    """Generate a trading signal from market data analysis."""
    return {
        "domain": "signal_generation",
        "status": "signal_generated",
        "instrument": data.get("instrument", "NQH6"),
        "confidence": 0.0,  # Wire to your actual TA pipeline
        "note": "Connect to your technical analysis engine",
    }


async def handle_risk_assessment(data: dict) -> dict:
    """Assess risk for a proposed trade or current positions."""
    return {
        "domain": "risk_assessment",
        "status": "assessed",
        "approved": True,
        "drawdown_cushion": 0,  # Wire to your Apex drawdown tracker
        "note": "Connect to your risk engine",
    }


async def handle_execution(data: dict) -> dict:
    """Execute an approved trade order."""
    return {
        "domain": "execution",
        "status": "routed",
        "order_id": None,  # Wire to Tradovate/Rithmic API
        "note": "Connect to your exchange API client",
    }


async def handle_data_enrichment(data: dict) -> dict:
    """Enrich data with vector search, historical context, sentiment."""
    return {
        "domain": "data_enrichment",
        "status": "enriched",
        "note": "Connect to Pinecone vector search",
    }


async def handle_compliance(data: dict) -> dict:
    """Validate action against Apex rules and regulations."""
    return {
        "domain": "compliance",
        "status": "compliant",
        "note": "Connect to your Apex rule engine",
    }


async def handle_monitoring(data: dict) -> dict:
    """Monitor system health and detect anomalies."""
    return {
        "domain": "monitoring",
        "status": "healthy",
        "note": "Connect to your health monitoring pipeline",
    }


async def handle_rendering(data: dict) -> dict:
    """Render dashboard state and UI updates."""
    return {
        "domain": "rendering",
        "status": "rendered",
        "note": "Connect to your dashboard WebSocket server",
    }


async def handle_coordination(data: dict) -> dict:
    """Coordinate topology and routing across the swarm."""
    return {
        "domain": "coordination",
        "status": "coordinated",
        "note": "Topology management handled by Bridge Builder",
    }


async def handle_prediction(data: dict) -> dict:
    """Run predictive analytics and forecasting models."""
    return {
        "domain": "prediction",
        "status": "predicted",
        "note": "Connect to your ML forecasting pipeline",
    }


async def handle_reasoning(data: dict) -> dict:
    """Perform Socratic reasoning and deep analysis."""
    return {
        "domain": "reasoning",
        "status": "analyzed",
        "note": "Connect to your reasoning engine",
    }


# Map domains to handlers
DOMAIN_HANDLERS = {
    "signal_generation": handle_signal_generation,
    "market_data": handle_signal_generation,
    "risk_assessment": handle_risk_assessment,
    "veto_authority": handle_risk_assessment,
    "execution": handle_execution,
    "order_routing": handle_execution,
    "data_enrichment": handle_data_enrichment,
    "vector_search": handle_data_enrichment,
    "compliance": handle_compliance,
    "regulatory": handle_compliance,
    "monitoring": handle_monitoring,
    "health_check": handle_monitoring,
    "rendering": handle_rendering,
    "dashboard": handle_rendering,
    "coordination": handle_coordination,
    "topology": handle_coordination,
    "prediction": handle_prediction,
    "forecasting": handle_prediction,
    "reasoning": handle_reasoning,
    "questioning": handle_reasoning,
    "analysis": handle_reasoning,
    "code_generation": handle_coordination,  # Jules
    "system_building": handle_coordination,  # Builder
    "navigation": handle_data_enrichment,    # Atlas
    "anomaly_detection": handle_monitoring,  # Observer
}


# ---------------------------------------------------------------------------
# BOOT — The one function that starts everything
# ---------------------------------------------------------------------------

async def boot(node_id: str = None):
    """Boot the Heady Liquid Latent OS on this runtime.
    
    This is the single entry point for the entire system. There is no
    frontend to start, no backend to configure, no server to run. Just
    boot the OS and it joins the living swarm.
    
    The boot sequence:
    1. Detect node identity from environment
    2. Create a LiquidNode with the right capabilities
    3. Register all domain handlers this node supports
    4. Boot the node (which handles Redis, checkpointing, recovery, etc.)
    5. The node runs until Colab kills it, then dies gracefully
    """
    # 1. Node identity
    node_id = node_id or os.environ.get("HEADY_NODE") or os.environ.get("HEADY_RUNTIME", "hot-us-east")
    redis_url = os.environ.get("REDIS_URL", "")
    checkpoint_dir = os.environ.get("CHECKPOINT_DIR", "/content/drive/MyDrive/heady/checkpoints")
    
    print("=" * 60)
    print("  HEADY LIQUID LATENT OS")
    print("  Sacred Geometry v4.0 — No Frontend. No Backend. Just Flow.")
    print("=" * 60)
    print(f"  Node:     {node_id}")
    print(f"  Redis:    {'connected' if redis_url else 'mock mode'}")
    print(f"  PHI:      {PHI}")
    print()
    
    # 2. Create the liquid node
    node = LiquidNode(
        node_id=node_id,
        redis_url=redis_url,
        checkpoint_dir=checkpoint_dir,
    )
    
    # 3. Register domain handlers
    node_config = NODE_CAPABILITIES.get(node_id, NODE_CAPABILITIES["hot-us-east"])
    
    for domain in node_config["domains"]:
        handler = DOMAIN_HANDLERS.get(domain)
        if handler:
            node.register_handler(domain, handler)
    
    print(f"  Role:     {node_config['role']}")
    print(f"  Agents:   {', '.join(node_config['agents'])}")
    print(f"  Domains:  {len(node_config['domains'])} registered")
    print(f"  Desc:     {node_config['description']}")
    print()
    print("  Booting liquid node...")
    print()
    
    # 4. Boot (this runs until death)
    try:
        await node.boot()
    except KeyboardInterrupt:
        print("\nInterrupted — initiating graceful death...")
        await node._graceful_death("keyboard_interrupt")
    except Exception as e:
        print(f"\nFatal error: {e}")
        await node._graceful_death(f"fatal_error:{str(e)[:100]}")
        raise


# ---------------------------------------------------------------------------
# Convenience: dispatch a task to the swarm from any node
# ---------------------------------------------------------------------------

async def dispatch(domain: str, payload: dict, target_node: str = None):
    """Dispatch a task to the swarm from anywhere.
    
    This is the liquid equivalent of an API call. Instead of hitting
    an endpoint on a specific server, you drop a task into the Redis
    Stream for the target domain and the swarm routes it to whichever
    node has capacity.
    
    If target_node is specified, the task goes to that node's stream.
    Otherwise, it goes to the broadcast stream and the swarm picks it up.
    """
    import redis.asyncio as aioredis
    
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        raise RuntimeError("REDIS_URL not set — cannot dispatch without Redis")
    
    r = aioredis.from_url(redis_url, decode_responses=True, health_check_interval=25)
    
    try:
        stream = f"heady:tasks:{target_node}" if target_node else "heady:tasks:broadcast"
        task_id = f"{domain}-{int(time.time() * 1000)}"
        
        await r.xadd(stream, {
            "task_id": task_id,
            "domain": domain,
            "payload": json.dumps(payload, default=str),
            "dispatched_by": os.environ.get("HEADY_NODE", "unknown"),
            "ts": str(time.time()),
        }, maxlen=10000)
        
        return task_id
    finally:
        await r.aclose()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Heady Liquid Latent OS — Entry Point")
    print("=" * 50)
    print()
    print("Node configurations:")
    for nid, cfg in NODE_CAPABILITIES.items():
        print(f"  {nid:20s} [{cfg['role']:10s}] {len(cfg['agents'])} agents, {len(cfg['domains'])} domains")
        print(f"  {'':20s} agents: {', '.join(cfg['agents'])}")
        print()
    
    print("Extended agents:")
    for aid, cfg in EXTENDED_AGENTS.items():
        print(f"  {aid:12s} — {cfg['description']}")
    
    print()
    print("Domain handlers registered:", len(DOMAIN_HANDLERS))
    print()
    print("To boot the OS:")
    print("  await boot()                    # Auto-detect node from env")
    print('  await boot("hot-us-east")       # Explicit node identity')
    print()
    print("To dispatch a task:")
    print('  await dispatch("signal_generation", {"instrument": "NQH6"})')
