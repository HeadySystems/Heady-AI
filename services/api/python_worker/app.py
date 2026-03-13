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
# ║  FILE: services/api/python_worker/app.py                         ║
# ║  LAYER: services                                                 ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

"""
Heady Python Worker — Background jobs, ML inference, and data processing.
Runs as a standalone FastAPI service on port 5000.
"""

import os
import logging
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("heady-worker")

# Try FastAPI, fall back to basic HTTP server
try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

# ═══════════════════════════════════════════════════════════════════
# Worker State
# ═══════════════════════════════════════════════════════════════════

class WorkerState:
    """Tracks worker job queue and execution state."""
    def __init__(self):
        self.jobs: List[Dict] = []
        self.completed: List[Dict] = []
        self.started_at = datetime.now().isoformat()
        self.job_counter = 0

    def submit(self, job_type: str, payload: Dict[str, Any]) -> Dict:
        self.job_counter += 1
        job = {
            "id": f"job-{self.job_counter:06d}",
            "type": job_type,
            "payload": payload,
            "status": "queued",
            "submitted_at": datetime.now().isoformat(),
            "completed_at": None,
            "result": None,
        }
        self.jobs.append(job)
        logger.info(f"Job submitted: {job['id']} type={job_type}")
        return job

    def process_next(self) -> Optional[Dict]:
        queued = [j for j in self.jobs if j["status"] == "queued"]
        if not queued:
            return None

        job = queued[0]
        job["status"] = "running"
        logger.info(f"Processing job: {job['id']}")

        try:
            result = self._execute(job)
            job["status"] = "completed"
            job["result"] = result
            job["completed_at"] = datetime.now().isoformat()
        except Exception as e:
            job["status"] = "failed"
            job["result"] = {"error": str(e)}
            job["completed_at"] = datetime.now().isoformat()
            logger.error(f"Job {job['id']} failed: {e}")

        self.completed.append(job)
        return job

    def _execute(self, job: Dict) -> Dict:
        """Execute a job based on its type."""
        handlers = {
            "nlp_generate": self._handle_nlp,
            "health_check": self._handle_health,
            "build": self._handle_build,
            "echo": self._handle_echo,
        }
        handler = handlers.get(job["type"], self._handle_default)
        return handler(job["payload"])

    def _handle_nlp(self, payload: Dict) -> Dict:
        prompt = payload.get("prompt", "")
        return {"response": f"Heady AI: Processed '{prompt[:50]}...'", "model": "heady-worker"}

    def _handle_health(self, payload: Dict) -> Dict:
        import platform
        return {
            "status": "healthy",
            "platform": platform.platform(),
            "python": platform.python_version(),
            "uptime_since": self.started_at,
        }

    def _handle_build(self, payload: Dict) -> Dict:
        target = payload.get("target", "default")
        return {"built": True, "target": target, "timestamp": datetime.now().isoformat()}

    def _handle_echo(self, payload: Dict) -> Dict:
        return {"echo": payload}

    def _handle_default(self, payload: Dict) -> Dict:
        return {"processed": True, "payload": payload}

    def get_status(self) -> Dict:
        return {
            "started_at": self.started_at,
            "total_jobs": self.job_counter,
            "queued": len([j for j in self.jobs if j["status"] == "queued"]),
            "running": len([j for j in self.jobs if j["status"] == "running"]),
            "completed": len(self.completed),
        }


state = WorkerState()

# ═══════════════════════════════════════════════════════════════════
# FastAPI Application
# ═══════════════════════════════════════════════════════════════════

if HAS_FASTAPI:
    app = FastAPI(title="Heady Python Worker", version="1.0.0")

    class JobRequest(BaseModel):
        job_type: str
        payload: Dict[str, Any] = {}

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "heady-python-worker", "started_at": state.started_at}

    @app.get("/status")
    async def status():
        return state.get_status()

    @app.post("/jobs")
    async def submit_job(req: JobRequest):
        job = state.submit(req.job_type, req.payload)
        return job

    @app.post("/jobs/process")
    async def process_job():
        result = state.process_next()
        if not result:
            raise HTTPException(status_code=404, detail="No queued jobs")
        return result

    @app.get("/jobs")
    async def list_jobs():
        return {"jobs": state.jobs[-50:], "completed": state.completed[-50:]}


# ═══════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    if HAS_FASTAPI:
        import uvicorn
        logger.info(f"Starting Heady Python Worker on port {port}")
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        from http.server import HTTPServer, BaseHTTPRequestHandler
        import json

        class SimpleHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "service": "heady-python-worker"}).encode())

        logger.info(f"Starting basic HTTP worker on port {port} (install fastapi+uvicorn for full features)")
        HTTPServer(("0.0.0.0", port), SimpleHandler).serve_forever()
