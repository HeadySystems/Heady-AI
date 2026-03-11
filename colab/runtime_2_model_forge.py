"""
Heady Runtime 2: Model Forge
LLM provider routing, embedding model routing, circuit breakers, batched inference.
Phi-scaled parameters throughout. No magic numbers.
"""

import asyncio
import json
import os
import signal
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, AsyncGenerator

import structlog
from aiohttp import web

logger = structlog.get_logger("heady.model_forge")

# ─── Sacred Constants ───────────────────────────────────────────────────────
PHI = 1.618033988749895
PSI = 1.0 / PHI
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]

# Token budgets (phi-weighted allocation)
TOKEN_BUDGETS = {
    "hot": int(4096 * PHI),     # ~6627 — latency-critical
    "warm": 4096,                # standard
    "cold": int(4096 * PSI),    # ~2531 — batch mode
}

# Retry delays (phi-exponential backoff, ms)
RETRY_DELAYS_MS = [int(1000 * (PHI ** i)) for i in range(5)]
# → [1000, 1618, 2618, 4236, 6854]

# Queue sizes (Fibonacci)
QUEUE_SIZES = {
    "inference": FIB[8],   # 34
    "embedding": FIB[9],   # 55
    "batch": FIB[10],      # 89
}


class CircuitState(str, Enum):
    CLOSED = "closed"        # Normal operation
    OPEN = "open"            # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreaker:
    """Per-provider circuit breaker with phi-backoff recovery."""
    name: str
    failure_threshold: int = FIB[5]       # 8 failures to open
    recovery_timeout: float = PHI * 30    # ~48.5s before half-open probe
    half_open_max: int = FIB[3]           # 3 probe requests
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0.0
    half_open_attempts: int = 0

    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_attempts += 1
            if self.half_open_attempts >= self.half_open_max:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.half_open_attempts = 0
                logger.info("circuit_closed", provider=self.name)
        self.success_count += 1

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning("circuit_opened", provider=self.name, failures=self.failure_count)

    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.half_open_attempts = 0
                logger.info("circuit_half_open", provider=self.name)
                return True
            return False
        # HALF_OPEN — allow limited probes
        return self.half_open_attempts < self.half_open_max

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "state": self.state,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
        }


@dataclass
class ProviderConfig:
    name: str
    model_id: str
    api_key_env: str
    base_url: str
    max_tokens: int = 4096
    supports_streaming: bool = True
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0


# Provider registry
PROVIDERS = {
    "claude": ProviderConfig(
        name="claude",
        model_id=os.environ.get("HEADY_CLAUDE_MODEL", "claude-sonnet-4-20250514"),
        api_key_env="ANTHROPIC_API_KEY",
        base_url="https://api.anthropic.com/v1",
        cost_per_1k_input=0.003,
        cost_per_1k_output=0.015,
    ),
    "gpt4o": ProviderConfig(
        name="gpt4o",
        model_id=os.environ.get("HEADY_GPT_MODEL", "gpt-4o"),
        api_key_env="OPENAI_API_KEY",
        base_url="https://api.openai.com/v1",
        cost_per_1k_input=0.005,
        cost_per_1k_output=0.015,
    ),
    "gemini": ProviderConfig(
        name="gemini",
        model_id=os.environ.get("HEADY_GEMINI_MODEL", "gemini-2.5-pro"),
        api_key_env="GOOGLE_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta",
        cost_per_1k_input=0.00125,
        cost_per_1k_output=0.005,
    ),
    "groq": ProviderConfig(
        name="groq",
        model_id=os.environ.get("HEADY_GROQ_MODEL", "llama-3.1-70b-versatile"),
        api_key_env="GROQ_API_KEY",
        base_url="https://api.groq.com/openai/v1",
        cost_per_1k_input=0.00059,
        cost_per_1k_output=0.00079,
    ),
}

EMBEDDING_PROVIDERS = {
    "nomic": {"model": "nomic-embed-text-v1.5", "dim": 384, "api_key_env": "NOMIC_API_KEY"},
    "jina": {"model": "jina-embeddings-v3", "dim": 384, "api_key_env": "JINA_API_KEY"},
    "cohere": {"model": "embed-english-v3.0", "dim": 384, "api_key_env": "COHERE_API_KEY"},
    "voyage": {"model": "voyage-3", "dim": 384, "api_key_env": "VOYAGE_API_KEY"},
}


class LLMRouter:
    """
    Intelligent LLM provider router with circuit breakers,
    capability matching, and cost tracking.
    """

    def __init__(self):
        self.circuits: dict[str, CircuitBreaker] = {}
        self.latencies: dict[str, list[float]] = {}
        self.token_usage: dict[str, dict] = {}
        self._budget_remaining = float(os.environ.get("HEADY_TOKEN_BUDGET", "1000000"))

        for name in PROVIDERS:
            self.circuits[name] = CircuitBreaker(name=name)
            self.latencies[name] = []
            self.token_usage[name] = {"input": 0, "output": 0, "cost": 0.0}

    def select_provider(self, task_type: str = "general", prefer: Optional[str] = None) -> Optional[str]:
        """
        Select optimal provider based on capability, health, and latency.
        No priority ranking — pure capability matching.
        """
        candidates = []

        # Task-to-capability mapping
        capability_map = {
            "code": ["claude", "gpt4o"],
            "creative": ["claude", "gemini"],
            "analysis": ["gpt4o", "gemini", "claude"],
            "fast": ["groq", "gemini"],
            "general": list(PROVIDERS.keys()),
        }

        capable = capability_map.get(task_type, list(PROVIDERS.keys()))

        # If user prefers a specific provider and it's healthy, use it
        if prefer and prefer in capable:
            cb = self.circuits.get(prefer)
            if cb and cb.can_execute():
                return prefer

        for name in capable:
            cb = self.circuits.get(name)
            if not cb or not cb.can_execute():
                continue
            # Check API key availability
            config = PROVIDERS.get(name)
            if config and not os.environ.get(config.api_key_env):
                continue
            # Score by average latency (lower is better)
            avg_lat = (
                sum(self.latencies[name][-FIB[5]:]) / len(self.latencies[name][-FIB[5]:])
                if self.latencies[name] else float("inf")
            )
            candidates.append((name, avg_lat))

        if not candidates:
            logger.error("no_healthy_providers")
            return None

        # Select by lowest average latency among capable+healthy providers
        candidates.sort(key=lambda c: c[1])
        selected = candidates[0][0]
        return selected

    async def infer(self, prompt: str, system: str = "", task_type: str = "general",
                    max_tokens: int = 4096, prefer: Optional[str] = None) -> dict:
        """Route inference request to optimal provider."""
        provider_name = self.select_provider(task_type, prefer)
        if not provider_name:
            return {"error": "no_healthy_providers", "response": ""}

        config = PROVIDERS[provider_name]
        cb = self.circuits[provider_name]
        start = time.time()

        try:
            response = await self._call_provider(provider_name, config, prompt, system, max_tokens)
            elapsed = time.time() - start

            cb.record_success()
            self.latencies[provider_name].append(elapsed)
            # Keep only last Fibonacci-89 measurements
            if len(self.latencies[provider_name]) > FIB[10]:
                self.latencies[provider_name] = self.latencies[provider_name][-FIB[10]:]

            input_tokens = response.get("input_tokens", 0)
            output_tokens = response.get("output_tokens", 0)
            cost = (input_tokens / 1000 * config.cost_per_1k_input +
                    output_tokens / 1000 * config.cost_per_1k_output)

            self.token_usage[provider_name]["input"] += input_tokens
            self.token_usage[provider_name]["output"] += output_tokens
            self.token_usage[provider_name]["cost"] += cost
            self._budget_remaining -= cost

            return {
                "provider": provider_name,
                "model": config.model_id,
                "response": response.get("text", ""),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "latency_ms": round(elapsed * 1000, 2),
                "cost": round(cost, 6),
            }

        except Exception as e:
            cb.record_failure()
            logger.error("inference_failed", provider=provider_name, error=str(e))

            # Retry with next provider
            for delay_ms in RETRY_DELAYS_MS[:3]:
                fallback = self.select_provider(task_type)
                if fallback and fallback != provider_name:
                    logger.info("inference_fallback", from_p=provider_name, to_p=fallback)
                    try:
                        return await self.infer(prompt, system, task_type, max_tokens, prefer=fallback)
                    except Exception:
                        await asyncio.sleep(delay_ms / 1000)

            return {"error": str(e), "provider": provider_name, "response": ""}

    async def _call_provider(self, name: str, config: ProviderConfig,
                             prompt: str, system: str, max_tokens: int) -> dict:
        """Call a specific LLM provider. Real API integration."""
        api_key = os.environ.get(config.api_key_env, "")
        if not api_key:
            raise ValueError(f"Missing API key: {config.api_key_env}")

        import aiohttp

        if name == "claude":
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{config.base_url}/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": config.model_id,
                        "max_tokens": max_tokens,
                        "system": system or "You are a helpful assistant.",
                        "messages": [{"role": "user", "content": prompt}],
                    },
                    timeout=aiohttp.ClientTimeout(total=PHI * 60),
                ) as resp:
                    data = await resp.json()
                    return {
                        "text": data.get("content", [{}])[0].get("text", ""),
                        "input_tokens": data.get("usage", {}).get("input_tokens", 0),
                        "output_tokens": data.get("usage", {}).get("output_tokens", 0),
                    }

        elif name in ("gpt4o", "groq"):
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{config.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": config.model_id,
                        "max_tokens": max_tokens,
                        "messages": [
                            {"role": "system", "content": system or "You are a helpful assistant."},
                            {"role": "user", "content": prompt},
                        ],
                    },
                    timeout=aiohttp.ClientTimeout(total=PHI * 60),
                ) as resp:
                    data = await resp.json()
                    choice = data.get("choices", [{}])[0]
                    usage = data.get("usage", {})
                    return {
                        "text": choice.get("message", {}).get("content", ""),
                        "input_tokens": usage.get("prompt_tokens", 0),
                        "output_tokens": usage.get("completion_tokens", 0),
                    }

        elif name == "gemini":
            async with aiohttp.ClientSession() as session:
                url = f"{config.base_url}/models/{config.model_id}:generateContent?key={api_key}"
                async with session.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"maxOutputTokens": max_tokens},
                        "systemInstruction": {"parts": [{"text": system or "You are a helpful assistant."}]},
                    },
                    timeout=aiohttp.ClientTimeout(total=PHI * 60),
                ) as resp:
                    data = await resp.json()
                    candidates = data.get("candidates", [{}])
                    text = ""
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = parts[0].get("text", "") if parts else ""
                    usage = data.get("usageMetadata", {})
                    return {
                        "text": text,
                        "input_tokens": usage.get("promptTokenCount", 0),
                        "output_tokens": usage.get("candidatesTokenCount", 0),
                    }

        raise ValueError(f"Unknown provider: {name}")

    def get_health(self) -> dict:
        return {
            "providers": {name: cb.to_dict() for name, cb in self.circuits.items()},
            "budget_remaining": round(self._budget_remaining, 2),
            "token_usage": self.token_usage,
        }


class ModelForgeRuntime:
    """Runtime 2: Model Forge — LLM inference and model routing."""

    def __init__(self):
        self.router = LLMRouter()
        self.port = int(os.environ.get("HEADY_INFERENCE_PORT", "8081"))
        self.app = web.Application()
        self._setup_routes()
        self._start_time = time.time()
        self._request_count = 0
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_SIZES["inference"])

    def _setup_routes(self):
        self.app.router.add_get("/health", self._health)
        self.app.router.add_post("/infer", self._infer)
        self.app.router.add_post("/infer/batch", self._infer_batch)
        self.app.router.add_get("/providers", self._providers)
        self.app.router.add_get("/stats", self._stats)

    async def _health(self, request: web.Request) -> web.Response:
        health = self.router.get_health()
        healthy_count = sum(1 for cb in self.router.circuits.values() if cb.state == CircuitState.CLOSED)
        return web.json_response({
            "status": "healthy" if healthy_count > 0 else "degraded",
            "service": "heady-model-forge",
            "role": "model_forge",
            "uptime_seconds": round(time.time() - self._start_time, 2),
            "healthy_providers": healthy_count,
            "total_providers": len(self.router.circuits),
            "request_count": self._request_count,
            "queue_size": self._queue.qsize(),
            "budget_remaining": health["budget_remaining"],
        })

    async def _infer(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        prompt = body.get("prompt", "")
        system = body.get("system", "")
        task_type = body.get("task_type", "general")
        max_tokens = body.get("max_tokens", TOKEN_BUDGETS.get(body.get("pool", "warm"), 4096))
        prefer = body.get("prefer")

        if not prompt:
            return web.json_response({"error": "prompt required"}, status=400)

        result = await self.router.infer(prompt, system, task_type, max_tokens, prefer)
        return web.json_response(result)

    async def _infer_batch(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        prompts = body.get("prompts", [])
        system = body.get("system", "")
        task_type = body.get("task_type", "general")

        if not prompts:
            return web.json_response({"error": "prompts array required"}, status=400)

        # Execute batch concurrently with Fibonacci-sized concurrency limit
        sem = asyncio.Semaphore(FIB[5])  # max 8 concurrent

        async def bounded_infer(p):
            async with sem:
                return await self.router.infer(p, system, task_type)

        tasks = [bounded_infer(p) for p in prompts]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed = []
        for r in results:
            if isinstance(r, Exception):
                processed.append({"error": str(r), "response": ""})
            else:
                processed.append(r)

        return web.json_response({
            "results": processed,
            "count": len(processed),
            "concurrency": FIB[5],
        })

    async def _providers(self, request: web.Request) -> web.Response:
        providers = []
        for name, config in PROVIDERS.items():
            has_key = bool(os.environ.get(config.api_key_env))
            cb = self.router.circuits.get(name)
            providers.append({
                "name": name,
                "model": config.model_id,
                "available": has_key,
                "circuit_state": cb.state if cb else "unknown",
                "supports_streaming": config.supports_streaming,
            })
        return web.json_response({"providers": providers})

    async def _stats(self, request: web.Request) -> web.Response:
        return web.json_response({
            "token_budgets": TOKEN_BUDGETS,
            "queue_sizes": QUEUE_SIZES,
            "retry_delays_ms": RETRY_DELAYS_MS,
            "router_health": self.router.get_health(),
        })

    async def start(self):
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.port)
        await site.start()
        logger.info("model_forge_started", port=self.port)
        self._runner = runner

    async def shutdown(self):
        await self._runner.cleanup()
        logger.info("model_forge_shutdown")


async def main():
    runtime = ModelForgeRuntime()

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
