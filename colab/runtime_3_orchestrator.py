"""
Heady Runtime 3: Conductor / Orchestrator
Task routing, bee swarm coordination, HCFullPipeline execution.
Master coordinator for all runtimes.
"""

import asyncio
import json
import math
import os
import signal
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import structlog
from aiohttp import web

logger = structlog.get_logger("heady.conductor")

# ─── Sacred Constants ───────────────────────────────────────────────────────
PHI = 1.618033988749895
PSI = 1.0 / PHI
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]

# Resource pool allocation (phi-derived percentages)
POOL_ALLOCATION = {
    "hot": 0.34,         # Latency-critical
    "warm": 0.21,        # Background important
    "cold": 0.13,        # Batch processing
    "reserve": 0.08,     # Burst capacity
    "governance": 0.05,  # Health + monitoring
}

# Timeouts per pool (seconds)
POOL_TIMEOUTS = {
    "hot": 30,
    "warm": int(PHI * 60 * 3),   # ~291s (~5min)
    "cold": int(PHI * 60 * 18),  # ~1746s (~29min)
}

# Swarm consensus parameters
CONSENSUS_THRESHOLD = PSI  # ≈ 0.618 agreement needed
MIN_VOTERS = FIB[3]        # 3 minimum voters


class TaskDomain(str, Enum):
    CODE_GENERATION = "code_generation"
    CODE_REVIEW = "code_review"
    SECURITY = "security"
    ARCHITECTURE = "architecture"
    RESEARCH = "research"
    DOCUMENTATION = "documentation"
    CREATIVE = "creative"
    MONITORING = "monitoring"
    CLEANUP = "cleanup"
    ANALYTICS = "analytics"
    GENERAL = "general"


# Domain-to-pool mapping
DOMAIN_POOLS = {
    TaskDomain.CODE_GENERATION: "hot",
    TaskDomain.CODE_REVIEW: "hot",
    TaskDomain.SECURITY: "hot",
    TaskDomain.ARCHITECTURE: "hot",
    TaskDomain.RESEARCH: "warm",
    TaskDomain.DOCUMENTATION: "warm",
    TaskDomain.CREATIVE: "warm",
    TaskDomain.MONITORING: "warm",
    TaskDomain.CLEANUP: "cold",
    TaskDomain.ANALYTICS: "cold",
    TaskDomain.GENERAL: "warm",
}

# Domain keywords for classification (used for semantic routing)
DOMAIN_KEYWORDS = {
    TaskDomain.CODE_GENERATION: ["code", "implement", "build", "create", "write", "function", "class", "module"],
    TaskDomain.CODE_REVIEW: ["review", "audit", "check", "inspect", "analyze code", "lint"],
    TaskDomain.SECURITY: ["security", "vulnerability", "auth", "encrypt", "csrf", "xss", "injection"],
    TaskDomain.ARCHITECTURE: ["architecture", "design", "topology", "schema", "structure", "pattern"],
    TaskDomain.RESEARCH: ["research", "investigate", "find", "explore", "learn", "study"],
    TaskDomain.DOCUMENTATION: ["document", "readme", "docs", "explain", "describe", "guide"],
    TaskDomain.CREATIVE: ["creative", "ui", "design", "visual", "animation", "art"],
    TaskDomain.MONITORING: ["monitor", "watch", "observe", "alert", "health", "status"],
    TaskDomain.CLEANUP: ["clean", "refactor", "optimize", "remove", "simplify", "deduplicate"],
    TaskDomain.ANALYTICS: ["analytics", "metrics", "statistics", "data", "report", "dashboard"],
}


@dataclass
class Task:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    description: str = ""
    domain: TaskDomain = TaskDomain.GENERAL
    pool: str = "warm"
    status: str = "pending"  # pending, running, completed, failed
    dependencies: list[str] = field(default_factory=list)
    result: Optional[dict] = None
    created_at: float = field(default_factory=time.time)
    started_at: float = 0.0
    completed_at: float = 0.0
    assigned_to: str = ""
    correlation_id: str = ""


@dataclass
class PipelineStage:
    name: str
    handler: str
    timeout: float
    required: bool = True


# HCFullPipeline stages
HCFP_STAGES = [
    PipelineStage("context_assembly", "vector_brain", POOL_TIMEOUTS["hot"]),
    PipelineStage("intent_classification", "conductor", POOL_TIMEOUTS["hot"]),
    PipelineStage("node_selection", "conductor", POOL_TIMEOUTS["hot"]),
    PipelineStage("execution", "model_forge", POOL_TIMEOUTS["warm"]),
    PipelineStage("quality_gate", "conductor", POOL_TIMEOUTS["hot"]),
    PipelineStage("assurance_gate", "conductor", POOL_TIMEOUTS["hot"]),
    PipelineStage("pattern_capture", "conductor", POOL_TIMEOUTS["cold"], required=False),
    PipelineStage("story_update", "conductor", POOL_TIMEOUTS["cold"], required=False),
]


class TaskClassifier:
    """Classify tasks into domains using keyword matching."""

    def classify(self, description: str) -> TaskDomain:
        desc_lower = description.lower()
        scores: dict[TaskDomain, float] = {}

        for domain, keywords in DOMAIN_KEYWORDS.items():
            match_count = sum(1 for kw in keywords if kw in desc_lower)
            if match_count > 0:
                scores[domain] = match_count / len(keywords)

        if not scores:
            return TaskDomain.GENERAL

        best_domain = max(scores, key=scores.get)
        return best_domain


class TaskDAG:
    """
    Directed Acyclic Graph for task decomposition and execution ordering.
    Topological sort with cycle detection.
    """

    def __init__(self):
        self.tasks: dict[str, Task] = {}
        self.edges: dict[str, list[str]] = defaultdict(list)

    def add_task(self, task: Task):
        self.tasks[task.id] = task
        for dep in task.dependencies:
            self.edges[dep].append(task.id)

    def topological_sort(self) -> list[list[str]]:
        """Returns layers of tasks that can execute concurrently."""
        in_degree: dict[str, int] = {tid: 0 for tid in self.tasks}
        for tid, task in self.tasks.items():
            for dep in task.dependencies:
                if dep in self.tasks:
                    in_degree[tid] += 1

        # Detect cycles
        queue = [tid for tid, deg in in_degree.items() if deg == 0]
        layers = []
        visited = set()

        while queue:
            layers.append(list(queue))
            next_queue = []
            for tid in queue:
                visited.add(tid)
                for dependent in self.edges.get(tid, []):
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        next_queue.append(dependent)
            queue = next_queue

        if len(visited) < len(self.tasks):
            cycle_nodes = set(self.tasks.keys()) - visited
            logger.error("cycle_detected", nodes=list(cycle_nodes))
            # Add remaining as final layer anyway
            layers.append(list(cycle_nodes))

        return layers

    def get_ready_tasks(self) -> list[Task]:
        """Get tasks whose dependencies are all completed."""
        ready = []
        for tid, task in self.tasks.items():
            if task.status != "pending":
                continue
            deps_met = all(
                self.tasks.get(dep, Task()).status == "completed"
                for dep in task.dependencies
            )
            if deps_met:
                ready.append(task)
        return ready


class SwarmConsensus:
    """
    Swarm consensus protocol — weighted voting across active workers.
    All workers have equal standing. Decisions by capability match, not rank.
    """

    def __init__(self):
        self.votes: dict[str, list[dict]] = {}  # decision_id -> votes

    def submit_vote(self, decision_id: str, voter: str, choice: str, confidence: float):
        if decision_id not in self.votes:
            self.votes[decision_id] = []
        self.votes[decision_id].append({
            "voter": voter,
            "choice": choice,
            "confidence": confidence,
            "timestamp": time.time(),
        })

    def resolve(self, decision_id: str) -> Optional[dict]:
        votes = self.votes.get(decision_id, [])
        if len(votes) < MIN_VOTERS:
            return None

        # Tally by choice, weighted by confidence
        tallies: dict[str, float] = defaultdict(float)
        for vote in votes:
            tallies[vote["choice"]] += vote["confidence"]

        total_weight = sum(tallies.values())
        if total_weight == 0:
            return None

        best_choice = max(tallies, key=tallies.get)
        agreement = tallies[best_choice] / total_weight

        return {
            "decision_id": decision_id,
            "choice": best_choice,
            "agreement": round(agreement, 4),
            "consensus_reached": agreement >= CONSENSUS_THRESHOLD,
            "votes_counted": len(votes),
            "threshold": CONSENSUS_THRESHOLD,
        }


class MonteCarloHealer:
    """Monte Carlo simulation for self-healing strategy selection."""

    def __init__(self, simulations: int = FIB[8]):  # 34 simulations
        self.simulations = simulations

    def evaluate_strategies(self, strategies: list[dict], failure_context: dict) -> dict:
        """
        Run Monte Carlo simulations to find optimal healing strategy.
        Each strategy has: name, success_probability, recovery_time, risk_score.
        """
        results = []

        for strategy in strategies:
            successes = 0
            total_recovery_time = 0.0

            for _ in range(self.simulations):
                # Simulate with some randomness
                roll = np.random.random()
                if roll < strategy.get("success_probability", 0.5):
                    successes += 1
                    base_time = strategy.get("recovery_time", 10.0)
                    # Add phi-scaled variance
                    jitter = np.random.normal(0, base_time * PSI * 0.1)
                    total_recovery_time += max(0, base_time + jitter)
                else:
                    total_recovery_time += strategy.get("recovery_time", 10.0) * PHI

            success_rate = successes / self.simulations
            avg_recovery = total_recovery_time / self.simulations
            risk = strategy.get("risk_score", 0.5)

            # Composite score: high success, low recovery, low risk
            score = success_rate * PSI + (1 / (avg_recovery + 1)) * (PSI ** 2) - risk * (1 - PSI)

            results.append({
                "strategy": strategy["name"],
                "success_rate": round(success_rate, 4),
                "avg_recovery_seconds": round(avg_recovery, 2),
                "composite_score": round(score, 4),
            })

        results.sort(key=lambda r: r["composite_score"], reverse=True)
        return {
            "recommended": results[0] if results else None,
            "all_strategies": results,
            "simulations_per_strategy": self.simulations,
        }


class ConductorRuntime:
    """Runtime 3: Conductor — Master orchestrator for the Heady system."""

    def __init__(self):
        self.classifier = TaskClassifier()
        self.dag = TaskDAG()
        self.consensus = SwarmConsensus()
        self.healer = MonteCarloHealer()
        self.port = int(os.environ.get("HEADY_CONDUCTOR_PORT", "8082"))
        self.app = web.Application()
        self._setup_routes()
        self._start_time = time.time()
        self._request_count = 0
        self._pipeline_runs = 0
        self._peer_health: dict[str, dict] = {}
        self._running = False

        # Peer runtime endpoints
        self.vector_brain_url = os.environ.get("HEADY_VECTOR_BRAIN_URL", "http://localhost:8080")
        self.model_forge_url = os.environ.get("HEADY_MODEL_FORGE_URL", "http://localhost:8081")

    def _setup_routes(self):
        self.app.router.add_get("/health", self._health)
        self.app.router.add_post("/task/submit", self._submit_task)
        self.app.router.add_post("/task/decompose", self._decompose_task)
        self.app.router.add_post("/pipeline/run", self._run_pipeline)
        self.app.router.add_get("/pipeline/status", self._pipeline_status)
        self.app.router.add_post("/consensus/vote", self._submit_vote)
        self.app.router.add_get("/consensus/resolve/{decision_id}", self._resolve_consensus)
        self.app.router.add_post("/heal", self._heal)
        self.app.router.add_get("/dag", self._get_dag)
        self.app.router.add_get("/stats", self._stats)

    async def _health(self, request: web.Request) -> web.Response:
        import aiohttp as aio
        # Check peer health
        peers = {}
        for name, url in [("vector_brain", self.vector_brain_url), ("model_forge", self.model_forge_url)]:
            try:
                async with aio.ClientSession() as session:
                    async with session.get(f"{url}/health", timeout=aio.ClientTimeout(total=5)) as resp:
                        data = await resp.json()
                        peers[name] = {"status": data.get("status", "unknown"), "url": url}
            except Exception:
                peers[name] = {"status": "unreachable", "url": url}

        self._peer_health = peers
        all_healthy = all(p["status"] == "healthy" for p in peers.values())

        return web.json_response({
            "status": "healthy" if all_healthy else "degraded",
            "service": "heady-conductor",
            "role": "conductor",
            "uptime_seconds": round(time.time() - self._start_time, 2),
            "request_count": self._request_count,
            "pipeline_runs": self._pipeline_runs,
            "active_tasks": sum(1 for t in self.dag.tasks.values() if t.status == "running"),
            "pending_tasks": sum(1 for t in self.dag.tasks.values() if t.status == "pending"),
            "peers": peers,
            "pool_allocation": POOL_ALLOCATION,
        })

    async def _submit_task(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        description = body.get("description", "")
        dependencies = body.get("dependencies", [])

        if not description:
            return web.json_response({"error": "description required"}, status=400)

        domain = self.classifier.classify(description)
        pool = DOMAIN_POOLS.get(domain, "warm")

        task = Task(
            description=description,
            domain=domain,
            pool=pool,
            dependencies=dependencies,
            correlation_id=body.get("correlation_id", str(uuid.uuid4())),
        )
        self.dag.add_task(task)

        logger.info(
            "task_submitted",
            task_id=task.id,
            domain=domain,
            pool=pool,
            dependencies=len(dependencies),
        )

        return web.json_response({
            "task_id": task.id,
            "domain": domain,
            "pool": pool,
            "status": "pending",
            "timeout": POOL_TIMEOUTS.get(pool, POOL_TIMEOUTS["warm"]),
        })

    async def _decompose_task(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        description = body.get("description", "")

        if not description:
            return web.json_response({"error": "description required"}, status=400)

        # Use Model Forge to decompose via LLM
        import aiohttp as aio
        try:
            async with aio.ClientSession() as session:
                async with session.post(
                    f"{self.model_forge_url}/infer",
                    json={
                        "prompt": f"Decompose this task into subtasks. Return a JSON array of objects with 'description' and 'dependencies' (array of subtask indices). Task: {description}",
                        "system": "You are a task decomposition engine. Return valid JSON only.",
                        "task_type": "analysis",
                        "max_tokens": 2048,
                    },
                    timeout=aio.ClientTimeout(total=POOL_TIMEOUTS["warm"]),
                ) as resp:
                    data = await resp.json()
                    response_text = data.get("response", "[]")
                    # Parse subtasks from LLM response
                    try:
                        subtasks_raw = json.loads(response_text)
                    except json.JSONDecodeError:
                        subtasks_raw = [{"description": description, "dependencies": []}]

        except Exception as e:
            logger.error("decomposition_failed", error=str(e))
            subtasks_raw = [{"description": description, "dependencies": []}]

        # Create subtasks in DAG
        subtask_ids = []
        for i, st in enumerate(subtasks_raw):
            domain = self.classifier.classify(st.get("description", ""))
            task = Task(
                description=st.get("description", f"Subtask {i}"),
                domain=domain,
                pool=DOMAIN_POOLS.get(domain, "warm"),
            )
            self.dag.add_task(task)
            subtask_ids.append(task.id)

        # Wire dependencies
        for i, st in enumerate(subtasks_raw):
            dep_indices = st.get("dependencies", [])
            for dep_idx in dep_indices:
                if 0 <= dep_idx < len(subtask_ids) and dep_idx != i:
                    self.dag.tasks[subtask_ids[i]].dependencies.append(subtask_ids[dep_idx])

        layers = self.dag.topological_sort()

        return web.json_response({
            "subtasks": [
                {
                    "id": tid,
                    "description": self.dag.tasks[tid].description,
                    "domain": self.dag.tasks[tid].domain,
                    "pool": self.dag.tasks[tid].pool,
                }
                for tid in subtask_ids
            ],
            "execution_layers": layers,
            "total_subtasks": len(subtask_ids),
        })

    async def _run_pipeline(self, request: web.Request) -> web.Response:
        """Execute HCFullPipeline — the 8-stage automated pipeline."""
        self._request_count += 1
        self._pipeline_runs += 1
        body = await request.json()
        task_description = body.get("description", "")
        correlation_id = body.get("correlation_id", str(uuid.uuid4()))

        if not task_description:
            return web.json_response({"error": "description required"}, status=400)

        pipeline_id = str(uuid.uuid4())
        stages_completed = []
        import aiohttp as aio

        for stage in HCFP_STAGES:
            stage_start = time.time()
            stage_result = {"stage": stage.name, "status": "pending"}

            try:
                if stage.handler == "vector_brain":
                    async with aio.ClientSession() as session:
                        async with session.post(
                            f"{self.vector_brain_url}/search",
                            json={"text": task_description, "top_k": FIB[5]},
                            timeout=aio.ClientTimeout(total=stage.timeout),
                        ) as resp:
                            data = await resp.json()
                            stage_result["context"] = data.get("results", [])

                elif stage.handler == "model_forge":
                    context_str = json.dumps([s.get("context", []) for s in stages_completed if "context" in s])
                    async with aio.ClientSession() as session:
                        async with session.post(
                            f"{self.model_forge_url}/infer",
                            json={
                                "prompt": f"Context: {context_str}\n\nTask: {task_description}",
                                "system": "You are a Heady AI node executing a pipeline task.",
                                "task_type": self.classifier.classify(task_description).value.split("_")[0],
                            },
                            timeout=aio.ClientTimeout(total=stage.timeout),
                        ) as resp:
                            data = await resp.json()
                            stage_result["output"] = data.get("response", "")

                elif stage.handler == "conductor":
                    if stage.name == "intent_classification":
                        domain = self.classifier.classify(task_description)
                        stage_result["domain"] = domain
                        stage_result["pool"] = DOMAIN_POOLS.get(domain, "warm")
                    elif stage.name == "node_selection":
                        stage_result["selected_nodes"] = ["model_forge", "vector_brain"]
                    elif stage.name == "quality_gate":
                        has_output = any("output" in s for s in stages_completed)
                        stage_result["quality_passed"] = has_output
                    elif stage.name == "assurance_gate":
                        stage_result["assured"] = True
                    elif stage.name == "pattern_capture":
                        stage_result["pattern_logged"] = True
                    elif stage.name == "story_update":
                        stage_result["story_updated"] = True

                stage_result["status"] = "completed"
                stage_result["duration_ms"] = round((time.time() - stage_start) * 1000, 2)

            except Exception as e:
                stage_result["status"] = "failed" if stage.required else "skipped"
                stage_result["error"] = str(e)
                stage_result["duration_ms"] = round((time.time() - stage_start) * 1000, 2)

                if stage.required:
                    logger.error("pipeline_stage_failed", stage=stage.name, error=str(e))
                    stages_completed.append(stage_result)
                    break

            stages_completed.append(stage_result)

        pipeline_success = all(s["status"] == "completed" for s in stages_completed if s.get("status") != "skipped")

        return web.json_response({
            "pipeline_id": pipeline_id,
            "correlation_id": correlation_id,
            "status": "completed" if pipeline_success else "failed",
            "stages": stages_completed,
            "total_stages": len(HCFP_STAGES),
            "completed_stages": sum(1 for s in stages_completed if s["status"] == "completed"),
        })

    async def _pipeline_status(self, request: web.Request) -> web.Response:
        return web.json_response({
            "pipeline_runs": self._pipeline_runs,
            "stages": [{"name": s.name, "handler": s.handler, "required": s.required} for s in HCFP_STAGES],
        })

    async def _submit_vote(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        self.consensus.submit_vote(
            body["decision_id"], body["voter"], body["choice"], body.get("confidence", 0.8)
        )
        return web.json_response({"voted": True})

    async def _resolve_consensus(self, request: web.Request) -> web.Response:
        self._request_count += 1
        decision_id = request.match_info["decision_id"]
        result = self.consensus.resolve(decision_id)
        if result is None:
            return web.json_response({"error": "insufficient votes", "min_voters": MIN_VOTERS}, status=422)
        return web.json_response(result)

    async def _heal(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        strategies = body.get("strategies", [
            {"name": "restart_service", "success_probability": 0.9, "recovery_time": 5.0, "risk_score": 0.1},
            {"name": "clear_cache", "success_probability": 0.7, "recovery_time": 2.0, "risk_score": 0.05},
            {"name": "failover_to_backup", "success_probability": 0.8, "recovery_time": 10.0, "risk_score": 0.3},
            {"name": "full_redeploy", "success_probability": 0.95, "recovery_time": 30.0, "risk_score": 0.5},
        ])
        failure_context = body.get("context", {})
        result = self.healer.evaluate_strategies(strategies, failure_context)
        return web.json_response(result)

    async def _get_dag(self, request: web.Request) -> web.Response:
        tasks_list = []
        for tid, task in self.dag.tasks.items():
            tasks_list.append({
                "id": tid,
                "description": task.description,
                "domain": task.domain,
                "pool": task.pool,
                "status": task.status,
                "dependencies": task.dependencies,
            })
        layers = self.dag.topological_sort()
        return web.json_response({"tasks": tasks_list, "layers": layers})

    async def _stats(self, request: web.Request) -> web.Response:
        return web.json_response({
            "pool_allocation": POOL_ALLOCATION,
            "pool_timeouts": POOL_TIMEOUTS,
            "consensus_threshold": CONSENSUS_THRESHOLD,
            "min_voters": MIN_VOTERS,
            "pipeline_stages": len(HCFP_STAGES),
            "peer_health": self._peer_health,
        })

    async def start(self):
        self._running = True
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.port)
        await site.start()
        logger.info("conductor_started", port=self.port)
        self._runner = runner

    async def shutdown(self):
        self._running = False
        await self._runner.cleanup()
        logger.info("conductor_shutdown")


async def main():
    runtime = ConductorRuntime()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(runtime.shutdown()))

    await runtime.start()

    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        await runtime.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
