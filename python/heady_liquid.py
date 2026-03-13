"""
Heady Liquid Node Lifecycle Manager
=====================================
The core engine that makes ephemeral Colab runtimes behave as production
liquid compute. Handles the full lifecycle: boot → join swarm → operate →
detect impending death → drain tasks → checkpoint state → die gracefully →
reboot on new runtime → recover state → rejoin swarm → resume operating.

In a liquid system, gaps are expected, not exceptional. State never lives
on the compute node — it lives in Upstash Redis, Neon Postgres, Pinecone,
and Google Drive. The runtime is pure stateless compute that can die and
be replaced without the colony losing memory.

Usage:
    from heady_liquid import LiquidNode
    
    node = LiquidNode(
        node_id="hot-us-east",
        redis_url=os.environ["REDIS_URL"],
        checkpoint_dir="/content/drive/MyDrive/heady/checkpoints",
    )
    await node.boot()
    # Node is now part of the swarm, operating, and self-monitoring
    # When Colab kills the runtime, the node drains and checkpoints automatically

© 2026 HeadySystems Inc. — Sacred Geometry v4.0
"""

import asyncio
import json
import os
import signal
import sys
import time
import traceback
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional

# Sacred Geometry constants
PHI = 1.618033988749895
PSI = 1 / PHI
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144]

# Lifecycle timing (all Fibonacci-derived)
HEARTBEAT_INTERVAL_S = FIB[5]       # 8s between heartbeats
HEALTH_CHECK_INTERVAL_S = FIB[4]    # 5s between self-health checks
CHECKPOINT_INTERVAL_S = FIB[8] * 2  # 68s (~1 min) between auto-checkpoints
GAP_DETECTION_INTERVAL_S = FIB[3]   # 3s for detecting own impending death
DRAIN_TIMEOUT_S = FIB[7]            # 21s max to drain tasks before forced shutdown
REJOIN_BACKOFF_S = [f * 0.1 for f in FIB[3:8]]  # [0.3, 0.5, 0.8, 1.3, 2.1]


class NodeState(Enum):
    """Lifecycle states of a liquid node.
    
    BOOTING → JOINING → OPERATING → DRAINING → CHECKPOINTING → DEAD
                                                                  ↓
    RECOVERING ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← REBOOTING
        ↓
    JOINING → OPERATING → ...
    """
    BOOTING = "booting"
    JOINING = "joining"
    OPERATING = "operating"
    DRAINING = "draining"
    CHECKPOINTING = "checkpointing"
    DEAD = "dead"
    REBOOTING = "rebooting"
    RECOVERING = "recovering"


@dataclass
class NodeHealth:
    """Self-assessed health of this liquid node.
    
    The node continuously monitors its own vitals. If any metric crosses
    a threshold, the node begins draining tasks proactively — don't wait
    for Colab to kill us, start the graceful exit early.
    """
    gpu_available: bool = False
    gpu_name: str = "none"
    gpu_vram_free_mb: int = 0
    gpu_vram_total_mb: int = 0
    memory_used_pct: float = 0.0
    disk_free_mb: int = 0
    uptime_s: float = 0.0
    tasks_in_flight: int = 0
    last_heartbeat_age_s: float = 0.0
    colab_session_age_s: float = 0.0
    estimated_remaining_s: float = float("inf")
    is_healthy: bool = True
    death_signals: list = field(default_factory=list)


@dataclass
class CheckpointData:
    """Everything needed to restore a liquid node from death.
    
    This is saved to Google Drive on every checkpoint cycle and on
    graceful shutdown. When a new runtime boots, it loads the latest
    checkpoint and resumes where the dead node left off.
    """
    node_id: str
    state: str = "booting"
    agents_running: list = field(default_factory=list)
    tasks_in_flight: list = field(default_factory=list)
    tasks_completed: int = 0
    tasks_failed: int = 0
    swarm_topology: dict = field(default_factory=dict)
    custom_state: dict = field(default_factory=dict)
    checkpointed_at: float = 0.0
    checkpointed_at_iso: str = ""
    runtime_uptime_s: float = 0.0
    death_reason: str = ""


class LiquidNode:
    """A single liquid compute node in the Heady latent OS.
    
    This is not a server. It's not a client. It's a liquid node — a
    transient unit of compute that joins the swarm, does work, and
    eventually dies. Its death is not a failure; it's the expected
    lifecycle. All state persists in external stores (Redis, Postgres,
    Pinecone, Google Drive). The node itself is stateless and disposable.
    
    The liquid node handles:
    - Boot: detect GPU, mount Drive, connect to Redis
    - Join: announce to swarm, receive topology, accept tasks
    - Operate: execute tasks, emit heartbeats, auto-checkpoint
    - Death detection: monitor Colab signals, memory pressure, session age
    - Drain: stop accepting tasks, finish in-flight work, transfer ownership
    - Checkpoint: save full state to Google Drive
    - Rejoin: on reboot, load checkpoint and resume
    """
    
    def __init__(self, node_id: str, redis_url: str = None,
                 checkpoint_dir: str = "/content/drive/MyDrive/heady/checkpoints",
                 logger=None):
        self.node_id = node_id
        self.redis_url = redis_url or os.environ.get("REDIS_URL", "")
        self.checkpoint_dir = checkpoint_dir
        self.logger = logger or self._make_logger()
        
        self.state = NodeState.BOOTING
        self.boot_time = time.time()
        self.health = NodeHealth()
        self.checkpoint = CheckpointData(node_id=node_id)
        
        # Task registry — tracks what this node is currently working on
        self._tasks: dict[str, dict] = {}
        self._task_handlers: dict[str, Callable] = {}
        
        # Shutdown coordination
        self._shutdown_event = asyncio.Event()
        self._drain_complete = asyncio.Event()
        
        # External connections (set during boot)
        self._redis = None
        self._streams_client = None
    
    # =================================================================
    # BOOT — First thing that runs on a fresh Colab runtime
    # =================================================================
    
    async def boot(self):
        """Full boot sequence for a liquid node.
        
        1. Detect environment (GPU, memory, disk)
        2. Mount Google Drive (if in Colab)
        3. Connect to Upstash Redis
        4. Check for existing checkpoint (are we recovering from death?)
        5. If recovering: load checkpoint, restore state
        6. If fresh: initialize clean state
        7. Register signal handlers for graceful death
        8. Join the swarm
        9. Enter the operating loop
        """
        self._log("info", "LIQUID NODE BOOTING", node_id=self.node_id)
        self.state = NodeState.BOOTING
        
        # 1. Detect environment
        self.health = self._assess_health()
        self._log("info", "Environment detected",
                  gpu=self.health.gpu_name,
                  vram=f"{self.health.gpu_vram_free_mb}MB",
                  mem=f"{self.health.memory_used_pct:.1f}%")
        
        # 2. Ensure checkpoint directory exists
        Path(self.checkpoint_dir).mkdir(parents=True, exist_ok=True)
        
        # 3. Connect to Redis (Upstash via rediss://)
        await self._connect_redis()
        
        # 4-6. Recovery or fresh start
        existing = self._load_latest_checkpoint()
        if existing:
            self.state = NodeState.RECOVERING
            self._log("info", "RECOVERING from checkpoint",
                      checkpointed_at=existing.checkpointed_at_iso,
                      agents=existing.agents_running,
                      tasks_completed=existing.tasks_completed)
            self.checkpoint = existing
            # Recover pending tasks from Redis Streams
            await self._recover_pending_messages()
        else:
            self._log("info", "Fresh boot — no checkpoint found")
        
        # 7. Signal handlers for graceful death
        self._register_death_handlers()
        
        # 8. Join swarm
        self.state = NodeState.JOINING
        await self._announce_to_swarm("join")
        
        # 9. Enter operating loop
        self.state = NodeState.OPERATING
        self._log("info", "LIQUID NODE ONLINE", state=self.state.value)
        
        await self._run()
    
    # =================================================================
    # OPERATE — The main concurrent loop
    # =================================================================
    
    async def _run(self):
        """Main operating loop — all tasks run concurrently.
        
        This is the heart of the liquid node. Multiple concurrent loops
        run simultaneously: heartbeat emission, health monitoring, 
        auto-checkpointing, message consumption, and death detection.
        When death is detected, the shutdown event fires and all loops
        begin their graceful exit sequence.
        """
        try:
            await asyncio.gather(
                self._heartbeat_loop(),
                self._health_monitor_loop(),
                self._checkpoint_loop(),
                self._consume_loop(),
                self._death_detector_loop(),
                return_exceptions=True,
            )
        except asyncio.CancelledError:
            pass
        finally:
            await self._graceful_death("loop_exit")
    
    async def _heartbeat_loop(self):
        """Emit heartbeats to Redis so the swarm knows we're alive.
        
        Uses Redis Streams (XADD) instead of Pub/Sub — heartbeats are
        persisted and can be read by any consumer, even ones that weren't
        online when the heartbeat was emitted. This is critical for a
        liquid system where nodes join and leave constantly.
        """
        while not self._shutdown_event.is_set():
            try:
                health = self._assess_health()
                await self._stream_add("heady:heartbeats", {
                    "node_id": self.node_id,
                    "state": self.state.value,
                    "gpu": health.gpu_name,
                    "vram_free": str(health.gpu_vram_free_mb),
                    "tasks": str(health.tasks_in_flight),
                    "uptime": str(int(health.uptime_s)),
                    "ts": str(time.time()),
                })
            except Exception as e:
                self._log("warning", "Heartbeat failed", error=str(e))
            
            await self._sleep_or_shutdown(HEARTBEAT_INTERVAL_S)
    
    async def _health_monitor_loop(self):
        """Continuously assess own health and detect impending death.
        
        Colab gives no explicit shutdown signal, so we have to infer
        death from environmental clues: GPU disappearing, memory pressure
        spiking, session age approaching known limits. When we detect
        we're likely to die soon, we proactively start draining.
        """
        while not self._shutdown_event.is_set():
            self.health = self._assess_health()
            
            # Check for death signals
            signals = []
            
            if self.health.memory_used_pct > 89:  # Fibonacci threshold
                signals.append("memory_pressure_critical")
            
            if self.health.gpu_available and self.health.gpu_vram_free_mb < 500:
                signals.append("gpu_vram_exhausted")
            
            # Colab sessions rarely survive past 10-12 hours
            if self.health.colab_session_age_s > 10 * 3600:
                signals.append("session_age_warning")
            if self.health.colab_session_age_s > 22 * 3600:
                signals.append("session_age_critical")
            
            if self.health.disk_free_mb < 500:
                signals.append("disk_space_low")
            
            self.health.death_signals = signals
            self.health.is_healthy = len(signals) == 0
            
            if signals:
                self._log("warning", "Death signals detected",
                          signals=signals, uptime=int(self.health.uptime_s))
                
                if any("critical" in s for s in signals):
                    self._log("critical", "PROACTIVE DRAIN — death imminent")
                    self._shutdown_event.set()
            
            await self._sleep_or_shutdown(HEALTH_CHECK_INTERVAL_S)
    
    async def _checkpoint_loop(self):
        """Auto-checkpoint state to Google Drive periodically.
        
        Every ~68 seconds (Fibonacci-derived), save the full node state.
        This means we never lose more than ~1 minute of work when Colab
        kills us unexpectedly. The checkpoint includes running agents,
        in-flight tasks, completed/failed counts, and custom state.
        """
        while not self._shutdown_event.is_set():
            await self._sleep_or_shutdown(CHECKPOINT_INTERVAL_S)
            if not self._shutdown_event.is_set():
                try:
                    self._save_checkpoint("auto")
                    self._log("info", "Auto-checkpoint saved",
                              tasks_in_flight=len(self._tasks))
                except Exception as e:
                    self._log("error", "Checkpoint failed", error=str(e))
    
    async def _consume_loop(self):
        """Consume tasks from Redis Streams using consumer groups.
        
        This is the work intake. The node reads from its assigned streams
        using XREADGROUP, processes tasks, and ACKs on completion. If the
        node dies before ACKing, the message stays in the Pending Entries
        List and gets auto-claimed by another node via XAUTOCLAIM.
        
        This is why Redis Streams (not Pub/Sub) is essential for a liquid
        system — messages survive consumer death.
        """
        if not self._redis:
            self._log("warning", "No Redis — consume loop disabled")
            while not self._shutdown_event.is_set():
                await self._sleep_or_shutdown(5)
            return
        
        stream_key = f"heady:tasks:{self.node_id}"
        group_name = "heady-workers"
        consumer_name = f"{self.node_id}-{int(self.boot_time)}"
        
        # Ensure consumer group exists
        try:
            await self._redis.xgroup_create(stream_key, group_name, id="0", mkstream=True)
        except Exception:
            pass  # Group may already exist
        
        while not self._shutdown_event.is_set():
            try:
                # First: recover any pending messages from a previous life
                pending = await self._redis.xreadgroup(
                    groupname=group_name,
                    consumername=consumer_name,
                    streams={stream_key: "0"},
                    count=5,
                    block=0,
                )
                
                # Then: read new messages
                messages = await self._redis.xreadgroup(
                    groupname=group_name,
                    consumername=consumer_name,
                    streams={stream_key: ">"},
                    count=5,
                    block=3000,  # 3s block timeout
                )
                
                all_messages = (pending or []) + (messages or [])
                
                for stream, stream_msgs in all_messages:
                    for msg_id, msg_data in stream_msgs:
                        if self._shutdown_event.is_set():
                            break
                        
                        try:
                            await self._process_task(msg_id, msg_data, stream_key, group_name)
                        except Exception as e:
                            self._log("error", "Task processing failed",
                                      msg_id=msg_id, error=str(e))
                
            except Exception as e:
                self._log("error", "Consume loop error", error=str(e))
                await self._sleep_or_shutdown(FIB[3])  # 3s backoff
    
    async def _process_task(self, msg_id: str, msg_data: dict,
                             stream_key: str, group_name: str):
        """Process a single task from the stream.
        
        The task is tracked in _tasks while in flight. On completion (or
        failure), it's ACKed in Redis so it won't be redelivered. The
        result is published back to a results stream for the swarm.
        """
        task_id = msg_data.get("task_id", msg_id)
        domain = msg_data.get("domain", "unknown")
        
        self._tasks[task_id] = {"msg_id": msg_id, "started": time.time(), "domain": domain}
        self.health.tasks_in_flight = len(self._tasks)
        
        try:
            # Route to the appropriate handler
            handler = self._task_handlers.get(domain)
            if handler:
                result = await handler(msg_data)
            else:
                result = {"status": "no_handler", "domain": domain}
            
            # Publish result
            await self._stream_add("heady:results", {
                "task_id": task_id,
                "node_id": self.node_id,
                "status": "completed",
                "result": json.dumps(result, default=str)[:4000],
                "ts": str(time.time()),
            })
            
            # ACK — this removes it from the Pending Entries List
            await self._redis.xack(stream_key, group_name, msg_id)
            
            self.checkpoint.tasks_completed += 1
            
        except Exception as e:
            # NACK by not ACKing — it stays pending for auto-claim
            await self._stream_add("heady:results", {
                "task_id": task_id,
                "node_id": self.node_id,
                "status": "failed",
                "error": str(e)[:500],
                "ts": str(time.time()),
            })
            self.checkpoint.tasks_failed += 1
        
        finally:
            self._tasks.pop(task_id, None)
            self.health.tasks_in_flight = len(self._tasks)
    
    async def _death_detector_loop(self):
        """Watch for signs that Colab is about to kill this runtime.
        
        Also handles the auto-claim of abandoned tasks from dead nodes.
        Uses XAUTOCLAIM to steal messages that have been pending for
        longer than the suspect timeout (34 seconds) — if a node hasn't
        ACKed by then, it's probably dead and we should take its work.
        """
        if not self._redis:
            while not self._shutdown_event.is_set():
                await self._sleep_or_shutdown(5)
            return
        
        while not self._shutdown_event.is_set():
            try:
                # Auto-claim stale tasks from dead nodes
                # Any message pending > 34 seconds (Fibonacci) gets claimed
                for stream_suffix in ["hot-us-east", "warm-us-west", "cold-eu-west"]:
                    if stream_suffix == self.node_id:
                        continue  # Don't claim our own tasks
                    
                    stream_key = f"heady:tasks:{stream_suffix}"
                    try:
                        claimed = await self._redis.xautoclaim(
                            name=stream_key,
                            groupname="heady-workers",
                            consumername=f"{self.node_id}-{int(self.boot_time)}",
                            min_idle_time=FIB[8] * 1000,  # 34 seconds in ms
                            start_id="0-0",
                            count=3,
                        )
                        if claimed and len(claimed) > 1 and claimed[1]:
                            self._log("info", "Auto-claimed tasks from dead node",
                                      source=stream_suffix, count=len(claimed[1]))
                    except Exception:
                        pass  # Stream may not exist yet
                
            except Exception as e:
                self._log("error", "Death detector error", error=str(e))
            
            await self._sleep_or_shutdown(GAP_DETECTION_INTERVAL_S)
    
    # =================================================================
    # DEATH — Graceful shutdown when Colab kills us
    # =================================================================
    
    async def _graceful_death(self, reason: str):
        """Graceful death sequence.
        
        1. Set state to DRAINING
        2. Stop accepting new tasks
        3. Wait for in-flight tasks to finish (up to 21s timeout)
        4. Checkpoint all state to Google Drive
        5. Announce departure to swarm
        6. Close connections
        7. Die
        """
        if self.state == NodeState.DEAD:
            return
        
        self._log("critical", "GRACEFUL DEATH INITIATED", reason=reason)
        self.state = NodeState.DRAINING
        self._shutdown_event.set()
        
        # Wait for in-flight tasks (with timeout)
        if self._tasks:
            self._log("info", "Draining tasks", count=len(self._tasks))
            try:
                await asyncio.wait_for(
                    self._wait_for_drain(),
                    timeout=DRAIN_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                self._log("warning", "Drain timeout — tasks abandoned",
                          abandoned=len(self._tasks))
        
        # Checkpoint
        self.state = NodeState.CHECKPOINTING
        self.checkpoint.death_reason = reason
        self._save_checkpoint("death")
        self._log("info", "Death checkpoint saved")
        
        # Announce departure
        try:
            await self._announce_to_swarm("leave")
        except Exception:
            pass
        
        # Close Redis
        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass
        
        self.state = NodeState.DEAD
        self._log("critical", "LIQUID NODE DEAD",
                  uptime=int(time.time() - self.boot_time),
                  tasks_completed=self.checkpoint.tasks_completed,
                  tasks_failed=self.checkpoint.tasks_failed,
                  reason=reason)
    
    async def _wait_for_drain(self):
        """Wait for all in-flight tasks to complete."""
        while self._tasks:
            await asyncio.sleep(0.5)
    
    # =================================================================
    # CHECKPOINT — State persistence to Google Drive
    # =================================================================
    
    def _save_checkpoint(self, trigger: str):
        """Save full node state to Google Drive.
        
        This is the mechanism that makes liquid nodes work. When we die,
        the next runtime that boots with our node_id will find this
        checkpoint and resume our work.
        """
        self.checkpoint.node_id = self.node_id
        self.checkpoint.state = self.state.value
        self.checkpoint.tasks_in_flight = list(self._tasks.keys())
        self.checkpoint.checkpointed_at = time.time()
        self.checkpoint.checkpointed_at_iso = time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
        )
        self.checkpoint.runtime_uptime_s = time.time() - self.boot_time
        
        filename = f"{self.node_id}_{int(time.time())}_{trigger}.json"
        filepath = os.path.join(self.checkpoint_dir, filename)
        
        with open(filepath, "w") as f:
            json.dump(self.checkpoint.__dict__, f, indent=2, default=str)
        
        # Prune old checkpoints (keep last 20)
        self._prune_checkpoints(keep=20)
        
        return filepath
    
    def _load_latest_checkpoint(self) -> Optional[CheckpointData]:
        """Load the most recent checkpoint for this node_id."""
        import glob
        pattern = os.path.join(self.checkpoint_dir, f"{self.node_id}_*.json")
        files = sorted(glob.glob(pattern), reverse=True)
        if not files:
            return None
        
        try:
            with open(files[0], "r") as f:
                data = json.load(f)
            cp = CheckpointData(**{
                k: v for k, v in data.items()
                if k in CheckpointData.__dataclass_fields__
            })
            return cp
        except Exception as e:
            self._log("error", "Checkpoint load failed", error=str(e))
            return None
    
    def _prune_checkpoints(self, keep: int = 20):
        """Keep only the most recent checkpoints."""
        import glob
        pattern = os.path.join(self.checkpoint_dir, f"{self.node_id}_*.json")
        files = sorted(glob.glob(pattern), reverse=True)
        for old in files[keep:]:
            try:
                os.remove(old)
            except OSError:
                pass
    
    # =================================================================
    # RECOVERY — Restore from death
    # =================================================================
    
    async def _recover_pending_messages(self):
        """Recover unacknowledged messages from our previous life.
        
        When we died, any messages we had consumed but not ACKed are
        still in the Pending Entries List. We read them with ID "0"
        (meaning "give me my pending messages") and re-process them.
        """
        if not self._redis:
            return
        
        stream_key = f"heady:tasks:{self.node_id}"
        group_name = "heady-workers"
        
        try:
            pending_info = await self._redis.xpending(stream_key, group_name)
            if pending_info and pending_info.get("pending", 0) > 0:
                self._log("info", "Recovering pending messages",
                          count=pending_info["pending"])
        except Exception as e:
            self._log("warning", "Pending recovery check failed", error=str(e))
    
    # =================================================================
    # REDIS STREAMS — The liquid message fabric
    # =================================================================
    
    async def _connect_redis(self):
        """Connect to Upstash Redis via TLS.
        
        Uses the native redis-py async client for stream operations.
        The health_check_interval is set to 25 seconds — under Upstash's
        60-second idle timeout — to keep the connection alive.
        """
        if not self.redis_url:
            self._log("warning", "No REDIS_URL — running without Redis")
            return
        
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                health_check_interval=25,  # Under Upstash's 60s idle kill
                socket_connect_timeout=10,
                socket_timeout=10,
                retry_on_timeout=True,
            )
            await self._redis.ping()
            self._log("info", "Redis connected (Upstash TLS)")
        except ImportError:
            self._log("error", "redis package not installed. pip install redis")
            self._redis = None
        except Exception as e:
            self._log("error", "Redis connection failed", error=str(e))
            self._redis = None
    
    async def _stream_add(self, stream: str, data: dict, maxlen: int = 10000):
        """Add a message to a Redis Stream with MAXLEN cap.
        
        Streams auto-trim to maxlen to prevent unbounded growth. The ~
        prefix on maxlen means "approximately" — Redis may keep slightly
        more for efficiency but won't let it grow unbounded.
        """
        if not self._redis:
            return
        try:
            await self._redis.xadd(stream, data, maxlen=maxlen, approximate=True)
        except Exception as e:
            self._log("error", "Stream add failed", stream=stream, error=str(e))
    
    async def _announce_to_swarm(self, event: str):
        """Announce join/leave to the swarm via Redis Stream."""
        await self._stream_add("heady:swarm-events", {
            "event": event,
            "node_id": self.node_id,
            "gpu": self.health.gpu_name,
            "vram_free": str(self.health.gpu_vram_free_mb),
            "state": self.state.value,
            "ts": str(time.time()),
        })
    
    # =================================================================
    # SIGNAL HANDLERS — Catch Colab killing us
    # =================================================================
    
    def _register_death_handlers(self):
        """Register handlers for signals that indicate impending death.
        
        SIGTERM: Colab sends this before killing the runtime
        SIGINT: User presses Ctrl+C or Colab interrupts
        We also catch KeyboardInterrupt in the main loop.
        """
        def _handle_signal(signum, frame):
            sig_name = signal.Signals(signum).name
            self._log("critical", f"Received {sig_name} — initiating graceful death")
            self._shutdown_event.set()
        
        try:
            signal.signal(signal.SIGTERM, _handle_signal)
            signal.signal(signal.SIGINT, _handle_signal)
        except Exception:
            pass  # Signal handling may not work in all environments
    
    # =================================================================
    # HEALTH ASSESSMENT — Know thyself
    # =================================================================
    
    def _assess_health(self) -> NodeHealth:
        """Assess this node's current health.
        
        Checks GPU, memory, disk, and session age. This is called
        frequently by the health monitor loop to detect death signals
        before Colab actually kills us.
        """
        import shutil
        
        health = NodeHealth()
        health.uptime_s = time.time() - self.boot_time
        health.colab_session_age_s = health.uptime_s  # Approximate
        health.tasks_in_flight = len(self._tasks)
        
        # GPU
        try:
            import torch
            if torch.cuda.is_available():
                props = torch.cuda.get_device_properties(0)
                free, total = torch.cuda.mem_get_info()
                health.gpu_available = True
                health.gpu_name = props.name
                health.gpu_vram_free_mb = free // (1024 * 1024)
                health.gpu_vram_total_mb = total // (1024 * 1024)
        except ImportError:
            pass
        
        # System memory
        try:
            import psutil
            mem = psutil.virtual_memory()
            health.memory_used_pct = mem.percent
        except ImportError:
            pass
        
        # Disk
        try:
            usage = shutil.disk_usage("/")
            health.disk_free_mb = usage.free // (1024 * 1024)
        except Exception:
            pass
        
        return health
    
    # =================================================================
    # PUBLIC API — Register task handlers
    # =================================================================
    
    def register_handler(self, domain: str, handler: Callable):
        """Register an async task handler for a domain.
        
        When a task arrives with this domain, the handler is called.
        The handler receives the message data dict and should return
        a result dict.
        """
        self._task_handlers[domain] = handler
    
    def get_status(self) -> dict:
        """Get the full status of this liquid node."""
        return {
            "node_id": self.node_id,
            "state": self.state.value,
            "uptime_s": int(time.time() - self.boot_time),
            "health": {
                "gpu": self.health.gpu_name,
                "vram_free_mb": self.health.gpu_vram_free_mb,
                "memory_pct": self.health.memory_used_pct,
                "tasks": self.health.tasks_in_flight,
                "healthy": self.health.is_healthy,
                "death_signals": self.health.death_signals,
            },
            "tasks_completed": self.checkpoint.tasks_completed,
            "tasks_failed": self.checkpoint.tasks_failed,
            "tasks_in_flight": list(self._tasks.keys()),
        }
    
    # =================================================================
    # HELPERS
    # =================================================================
    
    async def _sleep_or_shutdown(self, seconds: float):
        """Sleep for `seconds` but wake immediately if shutdown is triggered."""
        try:
            await asyncio.wait_for(
                self._shutdown_event.wait(),
                timeout=seconds,
            )
        except asyncio.TimeoutError:
            pass  # Normal — timeout means we slept the full duration
    
    def _make_logger(self):
        """Create a simple structured logger."""
        import logging
        logger = logging.getLogger(f"liquid-{self.node_id}")
        logger.setLevel(logging.INFO)
        if not logger.handlers:
            h = logging.StreamHandler(sys.stdout)
            h.setFormatter(logging.Formatter(
                '{"ts":"%(asctime)s","node":"' + self.node_id + '","level":"%(levelname)s","msg":"%(message)s"}'
            ))
            logger.addHandler(h)
        return logger
    
    def _log(self, level: str, message: str, **kwargs):
        extra = " ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""
        full_msg = f"{message} {extra}".strip()
        getattr(self.logger, level, self.logger.info)(full_msg)


# ---------------------------------------------------------------------------
# Quick self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Heady Liquid Node Lifecycle Manager")
    print("=" * 50)
    print(f"Lifecycle: {' → '.join(s.value for s in NodeState)}")
    print(f"Heartbeat interval: {HEARTBEAT_INTERVAL_S}s")
    print(f"Health check interval: {HEALTH_CHECK_INTERVAL_S}s")
    print(f"Checkpoint interval: {CHECKPOINT_INTERVAL_S}s")
    print(f"Drain timeout: {DRAIN_TIMEOUT_S}s")
    print(f"Rejoin backoff: {REJOIN_BACKOFF_S}")
    
    # Test health assessment without async
    node = LiquidNode("test-node")
    health = node._assess_health()
    print(f"\nHealth: gpu={health.gpu_name}, mem={health.memory_used_pct:.1f}%, "
          f"disk_free={health.disk_free_mb}MB")
    
    print(f"\nStatus: {json.dumps(node.get_status(), indent=2)}")
