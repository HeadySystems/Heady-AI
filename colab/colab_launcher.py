"""
Heady Colab Launcher — Unified entry point for all 3 runtimes.
Detects role from HEADY_RUNTIME_ROLE env var and initializes the appropriate module.
"""

import asyncio
import os
import signal
import sys
import time

import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
)

logger = structlog.get_logger("heady.launcher")

PHI = 1.618033988749895

ROLE_MAP = {
    "vector_brain": {
        "module": "runtime_1_vector_brain",
        "class": "VectorBrainRuntime",
        "port_env": "HEADY_VECTOR_PORT",
        "default_port": 8080,
        "description": "384D embedding engine, semantic memory, CSL gates",
    },
    "model_forge": {
        "module": "runtime_2_model_forge",
        "class": "ModelForgeRuntime",
        "port_env": "HEADY_INFERENCE_PORT",
        "default_port": 8081,
        "description": "LLM provider routing, circuit breakers, batched inference",
    },
    "conductor": {
        "module": "runtime_3_orchestrator",
        "class": "ConductorRuntime",
        "port_env": "HEADY_CONDUCTOR_PORT",
        "default_port": 8082,
        "description": "Task routing, bee swarms, HCFullPipeline execution",
    },
}


def print_banner(role: str, config: dict):
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║                   HEADY LATENT SPACE OS                      ║
║              Sacred Geometry Architecture v4.0                ║
╠══════════════════════════════════════════════════════════════╣
║  Runtime Role : {role:<44}║
║  Description  : {config['description']:<44}║
║  Port         : {os.environ.get(config['port_env'], str(config['default_port'])):<44}║
║  PHI          : {PHI:<44}║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


async def launch(role: str):
    config = ROLE_MAP[role]
    print_banner(role, config)

    # Set default port if not specified
    if not os.environ.get(config["port_env"]):
        os.environ[config["port_env"]] = str(config["default_port"])

    # Dynamic import
    import importlib
    module = importlib.import_module(config["module"])
    runtime_class = getattr(module, config["class"])

    runtime = runtime_class()
    logger.info(
        "launching_runtime",
        role=role,
        port=os.environ.get(config["port_env"]),
        pid=os.getpid(),
    )

    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    shutdown_event = asyncio.Event()

    def handle_signal(sig):
        logger.info("shutdown_signal_received", signal=sig)
        shutdown_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_signal(s))

    # Start runtime
    await runtime.start()
    logger.info("runtime_started", role=role)

    # Wait for shutdown signal
    await shutdown_event.wait()

    # Graceful shutdown
    logger.info("shutting_down", role=role)
    await runtime.shutdown()
    logger.info("shutdown_complete", role=role)


def main():
    role = os.environ.get("HEADY_RUNTIME_ROLE", "").lower()

    if not role:
        print("Error: HEADY_RUNTIME_ROLE not set.")
        print(f"Available roles: {', '.join(ROLE_MAP.keys())}")
        print("\nUsage:")
        print("  export HEADY_RUNTIME_ROLE=vector_brain")
        print("  python colab_launcher.py")
        sys.exit(1)

    if role not in ROLE_MAP:
        print(f"Error: Unknown role '{role}'.")
        print(f"Available roles: {', '.join(ROLE_MAP.keys())}")
        sys.exit(1)

    try:
        import uvloop
        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
        logger.info("using_uvloop")
    except ImportError:
        logger.info("using_default_event_loop")

    asyncio.run(launch(role))


if __name__ == "__main__":
    main()
