# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: backend/python_worker/app.py                                                    ║
# ║  LAYER: backend                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

"""
Backend Python Worker — Task execution worker that connects to
heady-manager and processes background jobs.

Pulls tasks from the manager API and reports results back.
"""

import os
import time
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("heady-backend-worker")

MANAGER_URL = os.getenv("HEADY_MANAGER_URL", "http://localhost:3300")
WORKER_ID = os.getenv("WORKER_ID", f"worker-{os.getpid()}")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

# ═══════════════════════════════════════════════════════════════════
# Task Handlers
# ═══════════════════════════════════════════════════════════════════

def handle_build(payload: Dict[str, Any]) -> Dict:
    """Handle a build task."""
    target = payload.get("target", "default")
    logger.info(f"Building target: {target}")
    return {"built": True, "target": target, "worker": WORKER_ID}


def handle_audit(payload: Dict[str, Any]) -> Dict:
    """Handle an audit task."""
    scope = payload.get("scope", "full")
    logger.info(f"Running audit: scope={scope}")
    return {"audited": True, "scope": scope, "worker": WORKER_ID}


def handle_nlp(payload: Dict[str, Any]) -> Dict:
    """Handle an NLP inference task."""
    prompt = payload.get("prompt", "")
    logger.info(f"NLP inference: {prompt[:50]}")
    return {"response": f"Processed: {prompt[:100]}", "model": "heady-local", "worker": WORKER_ID}


def handle_health(payload: Dict[str, Any]) -> Dict:
    """Handle a health check task."""
    import platform
    return {
        "status": "healthy",
        "worker": WORKER_ID,
        "platform": platform.platform(),
        "python": platform.python_version(),
        "timestamp": datetime.now().isoformat(),
    }


TASK_HANDLERS = {
    "build": handle_build,
    "audit": handle_audit,
    "nlp": handle_nlp,
    "health": handle_health,
}


def process_task(task: Dict[str, Any]) -> Dict:
    """Process a task by dispatching to the appropriate handler."""
    task_type = task.get("type", "unknown")
    payload = task.get("payload", {})

    handler = TASK_HANDLERS.get(task_type)
    if not handler:
        return {"error": f"Unknown task type: {task_type}", "worker": WORKER_ID}

    try:
        result = handler(payload)
        return {"status": "completed", "task_id": task.get("id"), "result": result}
    except Exception as e:
        logger.error(f"Task {task.get('id')} failed: {e}")
        return {"status": "failed", "task_id": task.get("id"), "error": str(e)}


# ═══════════════════════════════════════════════════════════════════
# Worker Loop
# ═══════════════════════════════════════════════════════════════════

def poll_manager() -> Optional[Dict]:
    """Poll the manager for pending tasks."""
    try:
        import requests
        resp = requests.get(f"{MANAGER_URL}/api/worker/tasks", params={"worker_id": WORKER_ID}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("task"):
                return data["task"]
    except Exception as e:
        logger.debug(f"Poll failed (manager may not be running): {e}")
    return None


def report_result(task_id: str, result: Dict):
    """Report task result back to the manager."""
    try:
        import requests
        requests.post(
            f"{MANAGER_URL}/api/worker/results",
            json={"task_id": task_id, "worker_id": WORKER_ID, "result": result},
            timeout=10,
        )
    except Exception as e:
        logger.warning(f"Failed to report result for {task_id}: {e}")


def run_worker_loop():
    """Main worker loop — poll, process, report."""
    logger.info(f"Heady Backend Worker started: {WORKER_ID}")
    logger.info(f"Manager: {MANAGER_URL}, Poll interval: {POLL_INTERVAL}s")

    while True:
        task = poll_manager()
        if task:
            logger.info(f"Received task: {task.get('id')} type={task.get('type')}")
            result = process_task(task)
            report_result(task.get("id", "unknown"), result)
        time.sleep(POLL_INTERVAL)


# ═══════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    run_worker_loop()
