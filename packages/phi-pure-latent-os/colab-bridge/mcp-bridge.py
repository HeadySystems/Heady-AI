"""
© 2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

colab-bridge/mcp-bridge.py
FastAPI MCP bridge for Colab Pro+ GPU runtimes.

Exposes MCP tools over HTTP for consumption by the Heady MCP server:
  POST /embed          — generate_embedding (single text → 384D vector)
  POST /embed/batch    — batch_embed (texts[] → number[][] in FIB[8]=21 chunks)
  POST /infer          — gpu_inference (model + prompt → text response)
  GET  /health         — GPU utilization, VRAM, runtime metadata
  GET  /metrics        — Prometheus-style text metrics

Environment variables:
  HEADY_MCP_SECRET   — shared secret for Bearer auth (required)
  EMBED_MODEL        — HuggingFace model ID (default: sentence-transformers/all-MiniLM-L12-v2)
  INFER_MODEL        — inference model ID (default: google/gemma-2b-it)
  PORT               — server port (default: 8080)
  LOG_LEVEL          — logging level (default: INFO)
  TUNNEL_URL         — ngrok/Cloudflare tunnel URL for self-reporting in /health
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

# ─── φ-Math Constants ─────────────────────────────────────────────────────────

PHI     = 1.618033988749895
PSI     = 1 / PHI            # ≈ 0.618
FIB     = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]
# FIB[8] = 21 — embedding batch size
BATCH_SIZE = FIB[8]  # 21

# ─── Environment ──────────────────────────────────────────────────────────────

MCP_SECRET    = os.environ.get("HEADY_MCP_SECRET", "")
EMBED_MODEL   = os.environ.get("EMBED_MODEL", "sentence-transformers/all-MiniLM-L12-v2")
INFER_MODEL   = os.environ.get("INFER_MODEL", "google/gemma-2b-it")
PORT          = int(os.environ.get("PORT", "8080"))
LOG_LEVEL     = os.environ.get("LOG_LEVEL", "INFO").upper()
TUNNEL_URL    = os.environ.get("TUNNEL_URL", "")
EMBED_DIM     = 384  # Heady canonical embedding dimension

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='{"time":"%(asctime)s","level":"%(levelname)s","component":"mcp-bridge","message":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("mcp-bridge")

# ─── GPU Detection ────────────────────────────────────────────────────────────

class GpuInfo(BaseModel):
    available:        bool
    device_count:     int
    device_name:      str | None = None
    vram_total_mb:    float | None = None
    vram_used_mb:     float | None = None
    vram_free_mb:     float | None = None
    utilization_pct:  float | None = None
    cuda_version:     str | None = None
    driver_version:   str | None = None


def detect_gpu() -> GpuInfo:
    """Detect GPU availability and report VRAM / utilization via torch.cuda."""
    try:
        import torch  # type: ignore

        if not torch.cuda.is_available():
            return GpuInfo(available=False, device_count=0)

        device_count = torch.cuda.device_count()
        device_name  = torch.cuda.get_device_name(0)
        total        = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)
        reserved     = torch.cuda.memory_reserved(0)  / (1024 ** 2)
        allocated    = torch.cuda.memory_allocated(0) / (1024 ** 2)
        free         = total - reserved

        # Utilization via pynvml if available
        utilization: float | None = None
        driver_ver:  str  | None = None
        try:
            import pynvml  # type: ignore
            pynvml.nvmlInit()
            handle       = pynvml.nvmlDeviceGetHandleByIndex(0)
            util         = pynvml.nvmlDeviceGetUtilizationRates(handle)
            utilization  = float(util.gpu)
            driver_ver   = pynvml.nvmlSystemGetDriverVersion()
            pynvml.nvmlShutdown()
        except Exception:
            pass

        return GpuInfo(
            available       = True,
            device_count    = device_count,
            device_name     = device_name,
            vram_total_mb   = round(total, 2),
            vram_used_mb    = round(allocated, 2),
            vram_free_mb    = round(free, 2),
            utilization_pct = utilization,
            cuda_version    = torch.version.cuda,
            driver_version  = driver_ver,
        )
    except ImportError:
        log.warning("torch not installed — GPU detection unavailable.")
        return GpuInfo(available=False, device_count=0)
    except Exception as exc:
        log.error(f"GPU detection failed: {exc}")
        return GpuInfo(available=False, device_count=0)


# ─── Model Registry ───────────────────────────────────────────────────────────

class ModelRegistry:
    """Lazy-loads sentence-transformers and inference models."""

    def __init__(self) -> None:
        self._embed_model:  Any | None = None
        self._tokenizer:    Any | None = None
        self._infer_model:  Any | None = None
        self._infer_tok:    Any | None = None
        self._embed_device: str = "cpu"
        self._infer_device: str = "cpu"

    def _torch_device(self) -> str:
        try:
            import torch  # type: ignore
            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def load_embed(self) -> Any:
        if self._embed_model is None:
            try:
                from sentence_transformers import SentenceTransformer  # type: ignore
                device = self._torch_device()
                log.info(f"Loading embed model '{EMBED_MODEL}' on {device}")
                self._embed_model  = SentenceTransformer(EMBED_MODEL, device=device)
                self._embed_device = device
                log.info("Embed model loaded.")
            except ImportError:
                raise RuntimeError(
                    "sentence-transformers is required for embedding. "
                    "Install with: pip install sentence-transformers"
                )
        return self._embed_model

    def load_infer(self) -> tuple[Any, Any]:
        if self._infer_model is None:
            try:
                import torch  # type: ignore
                from transformers import AutoModelForCausalLM, AutoTokenizer  # type: ignore

                device = self._torch_device()
                dtype  = torch.float16 if device == "cuda" else torch.float32
                log.info(f"Loading inference model '{INFER_MODEL}' on {device}")
                self._infer_tok   = AutoTokenizer.from_pretrained(INFER_MODEL)
                self._infer_model = AutoModelForCausalLM.from_pretrained(
                    INFER_MODEL,
                    torch_dtype=dtype,
                    device_map="auto",
                    low_cpu_mem_usage=True,
                )
                self._infer_device = device
                log.info("Inference model loaded.")
            except ImportError:
                raise RuntimeError(
                    "transformers + torch are required for GPU inference. "
                    "Install with: pip install transformers torch"
                )
        return self._infer_model, self._infer_tok


registry = ModelRegistry()

# ─── Application Lifespan ─────────────────────────────────────────────────────

_start_time:  float    = 0.0
_gpu_info:    GpuInfo  = GpuInfo(available=False, device_count=0)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global _start_time, _gpu_info

    if not MCP_SECRET:
        log.error("HEADY_MCP_SECRET is not set — authentication will fail for all requests.")

    _start_time = time.time()
    _gpu_info   = detect_gpu()

    log.info(
        f"MCP Bridge starting | embed_model={EMBED_MODEL} | "
        f"infer_model={INFER_MODEL} | gpu={_gpu_info.available} | "
        f"device={_gpu_info.device_name or 'CPU'}"
    )

    # Pre-warm embedding model to avoid cold-start on first request
    try:
        registry.load_embed()
    except Exception as exc:
        log.warning(f"Embed model pre-warm failed (will retry on first request): {exc}")

    yield

    log.info("MCP Bridge shutting down.")


# ─── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Heady MCP Colab Bridge",
    description=(
        "FastAPI bridge exposing Heady MCP tools from a Colab Pro+ GPU runtime. "
        "All endpoints require Bearer authentication via HEADY_MCP_SECRET."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — restrict to Heady domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://headyme.com",
        "https://*.headyme.com",
        "https://headysystems.com",
        "https://*.headysystems.com",
        "https://headyconnection.org",
        "https://*.headyconnection.org",
        "https://headybuddy.org",
        "https://*.headybuddy.org",
        "https://headymcp.com",
        "https://*.headymcp.com",
        "https://headyio.com",
        "https://*.headyio.com",
        "https://headybot.com",
        "https://*.headybot.com",
        "https://headyapi.com",
        "https://*.headyapi.com",
        "https://headyai.com",
        "https://*.headyai.com",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

# ─── Auth ──────────────────────────────────────────────────────────────────────

security = HTTPBearer(auto_error=False)


def verify_secret(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> str:
    if not MCP_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server misconfiguration: HEADY_MCP_SECRET is not set.",
        )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    import hmac
    if not hmac.compare_digest(credentials.credentials, MCP_SECRET):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid bearer token.",
        )
    return credentials.credentials


# ─── Request / Response Models ─────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=32_768)
    dimensions: int = Field(default=EMBED_DIM, ge=1, le=4096)


class EmbedResponse(BaseModel):
    embedding:   list[float]
    dimensions:  int
    model:       str
    duration_ms: float


class BatchEmbedRequest(BaseModel):
    texts:      list[str] = Field(..., min_length=1, max_length=1000)
    dimensions: int       = Field(default=EMBED_DIM, ge=1, le=4096)

    @field_validator("texts")
    @classmethod
    def texts_non_empty(cls, v: list[str]) -> list[str]:
        for i, t in enumerate(v):
            if not t or not t.strip():
                raise ValueError(f"texts[{i}] must be a non-empty string.")
        return v


class BatchEmbedResponse(BaseModel):
    embeddings:  list[list[float]]
    total_texts: int
    batch_count: int
    model:       str
    duration_ms: float


class InferRequest(BaseModel):
    prompt:           str   = Field(..., min_length=1, max_length=32_768)
    max_new_tokens:   int   = Field(default=512, ge=1, le=4096)
    temperature:      float = Field(default=0.618, ge=0.0, le=2.0)  # PSI — phi-harmonic
    top_p:            float = Field(default=0.9, ge=0.0, le=1.0)
    do_sample:        bool  = True


class InferResponse(BaseModel):
    text:        str
    model:       str
    duration_ms: float
    gpu_used:    bool


class HealthResponse(BaseModel):
    status:       str
    uptime_s:     float
    timestamp:    str
    service:      str
    version:      str
    tunnel_url:   str | None
    gpu:          GpuInfo
    models_loaded: dict[str, bool]
    batch_size:   int


class MetricsResponse(BaseModel):
    requests_total:   int
    errors_total:     int
    embed_requests:   int
    infer_requests:   int
    uptime_s:         float


# ─── Request Counter (in-process, reset on restart) ──────────────────────────

_counters: dict[str, int] = {
    "requests_total": 0,
    "errors_total":   0,
    "embed_requests": 0,
    "infer_requests": 0,
}


def _inc(key: str) -> None:
    _counters[key] = _counters.get(key, 0) + 1


# ─── Utility ──────────────────────────────────────────────────────────────────

def chunk_list(lst: list[Any], size: int) -> list[list[Any]]:
    """Split a list into chunks of at most `size` elements."""
    return [lst[i : i + size] for i in range(0, len(lst), size)]


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post(
    "/embed",
    response_model=EmbedResponse,
    summary="Generate a single 384D embedding",
)
async def generate_embedding(
    req:   EmbedRequest,
    _auth: str = Depends(verify_secret),
) -> EmbedResponse:
    """Generate a 384D embedding for the provided text using the loaded model."""
    _inc("requests_total")
    _inc("embed_requests")
    t0 = time.perf_counter()
    try:
        model = await asyncio.get_event_loop().run_in_executor(None, registry.load_embed)
        embedding: list[float] = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: model.encode(req.text, normalize_embeddings=True).tolist(),
        )
        if len(embedding) != req.dimensions and len(embedding) == EMBED_DIM:
            # Truncate / pad to requested dimensions if model returns fixed dim
            embedding = embedding[: req.dimensions]
        return EmbedResponse(
            embedding   = embedding,
            dimensions  = len(embedding),
            model       = EMBED_MODEL,
            duration_ms = (time.perf_counter() - t0) * 1000,
        )
    except Exception as exc:
        _inc("errors_total")
        log.error(f"generate_embedding error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post(
    "/embed/batch",
    response_model=BatchEmbedResponse,
    summary=f"Batch embed texts in chunks of FIB[8]={BATCH_SIZE}",
)
async def batch_embed(
    req:   BatchEmbedRequest,
    _auth: str = Depends(verify_secret),
) -> BatchEmbedResponse:
    """
    Generate embeddings for multiple texts.
    Texts are processed in Fibonacci-sized batches (FIB[8]=21) to match
    Vertex AI batch semantics in genai-client.ts.
    """
    _inc("requests_total")
    _inc("embed_requests")
    t0     = time.perf_counter()
    chunks = chunk_list(req.texts, BATCH_SIZE)

    try:
        model = await asyncio.get_event_loop().run_in_executor(None, registry.load_embed)

        all_embeddings: list[list[float]] = []
        for chunk in chunks:
            chunk_embs: list[list[float]] = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda c=chunk: model.encode(c, normalize_embeddings=True).tolist(),
            )
            all_embeddings.extend(chunk_embs)

        return BatchEmbedResponse(
            embeddings  = all_embeddings,
            total_texts = len(req.texts),
            batch_count = len(chunks),
            model       = EMBED_MODEL,
            duration_ms = (time.perf_counter() - t0) * 1000,
        )
    except Exception as exc:
        _inc("errors_total")
        log.error(f"batch_embed error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post(
    "/infer",
    response_model=InferResponse,
    summary="Run GPU text inference",
)
async def gpu_inference(
    req:   InferRequest,
    _auth: str = Depends(verify_secret),
) -> InferResponse:
    """
    Run causal language model inference on a prompt using the loaded GPU model.
    Returns the generated text (not including the input prompt).
    """
    _inc("requests_total")
    _inc("infer_requests")
    t0 = time.perf_counter()

    try:
        import torch  # type: ignore

        def _infer() -> tuple[str, bool]:
            model, tokenizer = registry.load_infer()
            device    = "cuda" if torch.cuda.is_available() else "cpu"
            inputs    = tokenizer(req.prompt, return_tensors="pt").to(device)
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens = req.max_new_tokens,
                    temperature    = req.temperature if req.do_sample else 1.0,
                    top_p          = req.top_p if req.do_sample else 1.0,
                    do_sample      = req.do_sample,
                    pad_token_id   = tokenizer.eos_token_id,
                )
            # Decode only newly generated tokens (exclude prompt tokens)
            prompt_len  = inputs["input_ids"].shape[1]
            new_tokens  = outputs[0, prompt_len:]
            generated   = tokenizer.decode(new_tokens, skip_special_tokens=True)
            return generated, device == "cuda"

        generated, gpu_used = await asyncio.get_event_loop().run_in_executor(None, _infer)

        return InferResponse(
            text        = generated,
            model       = INFER_MODEL,
            duration_ms = (time.perf_counter() - t0) * 1000,
            gpu_used    = gpu_used,
        )
    except Exception as exc:
        _inc("errors_total")
        log.error(f"gpu_inference error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check with GPU utilization",
)
async def health() -> HealthResponse:
    """
    Returns service health including live GPU VRAM and utilization metrics.
    No authentication required — used by HeadyConductor for routing decisions.
    """
    # Refresh GPU info on each health poll (cheap operation)
    current_gpu = detect_gpu()

    return HealthResponse(
        status    = "ok",
        uptime_s  = round(time.time() - _start_time, 2),
        timestamp = datetime.now(timezone.utc).isoformat(),
        service   = "heady-mcp-bridge",
        version   = "1.0.0",
        tunnel_url = TUNNEL_URL or None,
        gpu        = current_gpu,
        models_loaded = {
            "embed": registry._embed_model is not None,
            "infer": registry._infer_model is not None,
        },
        batch_size = BATCH_SIZE,
    )


@app.get(
    "/metrics",
    response_model=MetricsResponse,
    summary="Request counters (Prometheus-compatible)",
)
async def metrics(
    _auth: str = Depends(verify_secret),
) -> MetricsResponse:
    """Returns in-process request counters for monitoring dashboards."""
    return MetricsResponse(
        requests_total = _counters.get("requests_total", 0),
        errors_total   = _counters.get("errors_total", 0),
        embed_requests = _counters.get("embed_requests", 0),
        infer_requests = _counters.get("infer_requests", 0),
        uptime_s       = round(time.time() - _start_time, 2),
    )


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info(f"Starting Heady MCP Bridge on port {PORT}")
    uvicorn.run(
        "mcp_bridge:app",
        host    = "0.0.0.0",
        port    = PORT,
        log_level = LOG_LEVEL.lower(),
        access_log = True,
        # No reload in production — Colab runtimes are ephemeral
        reload  = False,
    )
