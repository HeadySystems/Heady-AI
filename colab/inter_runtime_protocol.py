"""
Heady Inter-Runtime Communication Protocol
gRPC-based messaging between Colab Pro+ runtimes.
All constants use phi-scaling. No magic numbers.
"""

import asyncio
import json
import time
import hashlib
import hmac
import os
import struct
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional
import structlog

logger = structlog.get_logger("heady.protocol")

# ─── Sacred Constants ───────────────────────────────────────────────────────
PHI = 1.618033988749895
PSI = 1.0 / PHI  # ≈ 0.618
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]

# Connection pool sizing (Fibonacci)
POOL_MIN = FIB[2]   # 2
POOL_MAX = FIB[6]   # 13

# Retry backoff (phi-exponential, milliseconds)
BASE_BACKOFF_MS = 1000
RETRY_DELAYS_MS = [int(BASE_BACKOFF_MS * (PHI ** i)) for i in range(6)]
# → [1000, 1618, 2618, 4236, 6854, 11090]

# Heartbeat interval (phi-scaled seconds)
HEARTBEAT_INTERVAL = PHI * 10  # 16.18 seconds
HEARTBEAT_TIMEOUT = HEARTBEAT_INTERVAL * 3  # ~48.54 seconds

# Message types
class MessageType(str, Enum):
    VECTOR_QUERY = "vector_query"
    VECTOR_RESPONSE = "vector_response"
    INFERENCE_REQUEST = "inference_request"
    INFERENCE_RESPONSE = "inference_response"
    TASK_DISPATCH = "task_dispatch"
    TASK_RESULT = "task_result"
    HEALTH_PING = "health_ping"
    HEALTH_PONG = "health_pong"
    SWARM_CONSENSUS = "swarm_consensus"
    DRIFT_ALERT = "drift_alert"


class RuntimeRole(str, Enum):
    VECTOR_BRAIN = "vector_brain"
    MODEL_FORGE = "model_forge"
    CONDUCTOR = "conductor"


@dataclass
class RuntimeEndpoint:
    role: RuntimeRole
    host: str
    port: int
    healthy: bool = True
    last_heartbeat: float = 0.0
    latency_ms: float = 0.0
    consecutive_failures: int = 0


@dataclass
class HeadyMessage:
    msg_type: MessageType
    source: RuntimeRole
    target: RuntimeRole
    correlation_id: str
    payload: dict
    timestamp: float = field(default_factory=time.time)
    signature: str = ""

    def sign(self, secret: str) -> "HeadyMessage":
        raw = json.dumps({
            "type": self.msg_type,
            "source": self.source,
            "target": self.target,
            "correlation_id": self.correlation_id,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }, sort_keys=True)
        self.signature = hmac.new(
            secret.encode(), raw.encode(), hashlib.sha256
        ).hexdigest()
        return self

    def verify(self, secret: str) -> bool:
        expected = HeadyMessage(
            msg_type=self.msg_type,
            source=self.source,
            target=self.target,
            correlation_id=self.correlation_id,
            payload=self.payload,
            timestamp=self.timestamp,
        ).sign(secret).signature
        return hmac.compare_digest(self.signature, expected)

    def to_bytes(self) -> bytes:
        data = json.dumps(asdict(self)).encode("utf-8")
        length = struct.pack("!I", len(data))
        return length + data

    @classmethod
    def from_bytes(cls, raw: bytes) -> "HeadyMessage":
        data = json.loads(raw)
        return cls(**data)


class ConnectionPool:
    """Fibonacci-sized async connection pool for inter-runtime links."""

    def __init__(self, endpoint: RuntimeEndpoint, secret: str):
        self.endpoint = endpoint
        self.secret = secret
        self._pool: asyncio.Queue = asyncio.Queue(maxsize=POOL_MAX)
        self._size = 0
        self._min_size = POOL_MIN
        self._max_size = POOL_MAX
        self._lock = asyncio.Lock()

    async def initialize(self):
        for _ in range(self._min_size):
            conn = await self._create_connection()
            if conn:
                await self._pool.put(conn)

    async def _create_connection(self) -> Optional[asyncio.StreamWriter]:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.endpoint.host, self.endpoint.port),
                timeout=PHI * 3  # ~4.85s
            )
            self._size += 1
            logger.info(
                "connection_created",
                target=self.endpoint.role,
                pool_size=self._size,
            )
            return writer
        except Exception as e:
            logger.error(
                "connection_failed",
                target=self.endpoint.role,
                error=str(e),
            )
            return None

    async def acquire(self) -> Optional[asyncio.StreamWriter]:
        try:
            return self._pool.get_nowait()
        except asyncio.QueueEmpty:
            if self._size < self._max_size:
                return await self._create_connection()
            return await asyncio.wait_for(self._pool.get(), timeout=PHI * 5)

    async def release(self, conn: asyncio.StreamWriter):
        if conn and not conn.is_closing():
            await self._pool.put(conn)
        else:
            self._size -= 1

    async def close_all(self):
        while not self._pool.empty():
            conn = await self._pool.get()
            conn.close()
            await conn.wait_closed()
            self._size -= 1


class InterRuntimeBus:
    """
    Central communication bus for Heady inter-runtime messaging.
    Manages connection pools, heartbeats, message routing, and failover.
    """

    def __init__(self, local_role: RuntimeRole):
        self.local_role = local_role
        self.secret = os.environ.get("HEADY_INTER_RUNTIME_SECRET", "heady-dev-secret")
        self.endpoints: dict[RuntimeRole, RuntimeEndpoint] = {}
        self.pools: dict[RuntimeRole, ConnectionPool] = {}
        self._handlers: dict[MessageType, list] = {}
        self._running = False
        self._server = None
        self._heartbeat_tasks: list[asyncio.Task] = []

    def register_endpoint(self, role: RuntimeRole, host: str, port: int):
        ep = RuntimeEndpoint(role=role, host=host, port=port)
        self.endpoints[role] = ep
        self.pools[role] = ConnectionPool(ep, self.secret)
        logger.info("endpoint_registered", role=role, host=host, port=port)

    def on_message(self, msg_type: MessageType, handler):
        self._handlers.setdefault(msg_type, []).append(handler)

    async def start(self, listen_port: int):
        self._running = True
        # Initialize connection pools to peers
        for pool in self.pools.values():
            await pool.initialize()
        # Start TCP listener for incoming messages
        self._server = await asyncio.start_server(
            self._handle_connection, "0.0.0.0", listen_port
        )
        logger.info("bus_started", role=self.local_role, port=listen_port)
        # Start heartbeat loops
        for role, ep in self.endpoints.items():
            if role != self.local_role:
                task = asyncio.create_task(self._heartbeat_loop(role))
                self._heartbeat_tasks.append(task)

    async def _handle_connection(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            while self._running:
                length_bytes = await reader.readexactly(4)
                length = struct.unpack("!I", length_bytes)[0]
                data = await reader.readexactly(length)
                msg = HeadyMessage.from_bytes(data)

                if not msg.verify(self.secret):
                    logger.warning("invalid_signature", source=msg.source)
                    continue

                if msg.msg_type == MessageType.HEALTH_PING:
                    pong = HeadyMessage(
                        msg_type=MessageType.HEALTH_PONG,
                        source=self.local_role,
                        target=msg.source,
                        correlation_id=msg.correlation_id,
                        payload={"status": "healthy", "role": self.local_role},
                    ).sign(self.secret)
                    writer.write(pong.to_bytes())
                    await writer.drain()
                    continue

                handlers = self._handlers.get(msg.msg_type, [])
                for handler in handlers:
                    asyncio.create_task(handler(msg))

        except asyncio.IncompleteReadError:
            pass
        except Exception as e:
            logger.error("connection_handler_error", error=str(e))
        finally:
            writer.close()
            await writer.wait_closed()

    async def send(self, msg: HeadyMessage) -> Optional[HeadyMessage]:
        msg.sign(self.secret)
        pool = self.pools.get(msg.target)
        if not pool:
            logger.error("no_pool_for_target", target=msg.target)
            return None

        for attempt, delay_ms in enumerate(RETRY_DELAYS_MS):
            conn = await pool.acquire()
            if not conn:
                await asyncio.sleep(delay_ms / 1000)
                continue
            try:
                conn.write(msg.to_bytes())
                await conn.drain()
                await pool.release(conn)
                logger.info(
                    "message_sent",
                    type=msg.msg_type,
                    target=msg.target,
                    attempt=attempt,
                )
                return msg
            except Exception as e:
                logger.warning(
                    "send_failed",
                    target=msg.target,
                    attempt=attempt,
                    error=str(e),
                )
                await pool.release(None)
                await asyncio.sleep(delay_ms / 1000)

        logger.error("send_exhausted_retries", target=msg.target)
        return None

    async def _heartbeat_loop(self, target_role: RuntimeRole):
        import uuid
        while self._running:
            try:
                ping = HeadyMessage(
                    msg_type=MessageType.HEALTH_PING,
                    source=self.local_role,
                    target=target_role,
                    correlation_id=str(uuid.uuid4()),
                    payload={},
                )
                start = time.time()
                result = await self.send(ping)
                elapsed_ms = (time.time() - start) * 1000

                ep = self.endpoints.get(target_role)
                if ep:
                    if result:
                        ep.healthy = True
                        ep.last_heartbeat = time.time()
                        ep.latency_ms = elapsed_ms
                        ep.consecutive_failures = 0
                    else:
                        ep.consecutive_failures += 1
                        if ep.consecutive_failures >= 3:
                            ep.healthy = False
                            logger.warning(
                                "runtime_degraded",
                                target=target_role,
                                failures=ep.consecutive_failures,
                            )
            except Exception as e:
                logger.error("heartbeat_error", target=target_role, error=str(e))

            await asyncio.sleep(HEARTBEAT_INTERVAL)

    def get_health(self) -> dict:
        peers = {}
        for role, ep in self.endpoints.items():
            if role != self.local_role:
                peers[role] = {
                    "healthy": ep.healthy,
                    "latency_ms": round(ep.latency_ms, 2),
                    "last_heartbeat": ep.last_heartbeat,
                    "consecutive_failures": ep.consecutive_failures,
                }
        return {
            "role": self.local_role,
            "running": self._running,
            "peers": peers,
        }

    async def shutdown(self):
        self._running = False
        for task in self._heartbeat_tasks:
            task.cancel()
        for pool in self.pools.values():
            await pool.close_all()
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        logger.info("bus_shutdown", role=self.local_role)
