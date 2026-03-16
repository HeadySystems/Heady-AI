/**
 * HeadyBuddy Core Models — Shared across work profile, companion, and testing modules.
 * © 2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */
package com.headysystems.buddy.core.models

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

// ─── PERMISSION MAP ─────────────────────────────────────

enum class AccessLevel(val displayName: String) {
    READ_ONLY("Read Only"),
    FULL_ACCESS("Full Access"),
    REVOKED("Revoked");
}

@Entity(tableName = "app_permissions")
data class AppPermission(
    @PrimaryKey val appPackage: String,
    val accessLevel: AccessLevel,
    val grantedAt: Long,
    val lastSyncedAt: Long = 0L
)

// ─── MEMORY ─────────────────────────────────────────────

@Entity(tableName = "memory_entries")
data class MemoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val content: String,
    val taskId: String? = null,
    val timestamp: Long,
    val cslScore: Float,
    val synced: Boolean = false
)

@Serializable
data class MemoryEntry(
    val type: String,
    val content: String,
    val taskId: String? = null,
    val timestamp: Long,
    val cslScore: Float
) {
    fun toEntity() = MemoryEntity(
        type = type, content = content, taskId = taskId,
        timestamp = timestamp, cslScore = cslScore
    )
}

@Serializable
data class ContextMemory(
    val type: String,
    val content: String,
    val score: Float
) {
    fun toEntity() = MemoryEntity(
        type = type, content = content,
        timestamp = System.currentTimeMillis(), cslScore = score
    )
}

// ─── MEMORY BOOTSTRAP ───────────────────────────────────

@Serializable
data class MemoryBootstrapRequest(
    val userId: String,
    val siteId: String = "headybuddy-android",
    val cslThreshold: Float = 0.618f,
    val topK: Int = 21,
    val dims: Int = 384
)

@Serializable
data class MemoryBootstrapResponse(
    val memoryCount: Int,
    val topDimensions: List<Int>,
    val contextMemories: List<ContextMemory>,
    val cslScore: Float,
    val workApps: List<String>
)

// ─── TASKS ──────────────────────────────────────────────

@Serializable
data class HeadyTask(
    val taskId: String,
    val appPackage: String,
    val functionId: String? = null,
    val intent: String? = null,
    val params: Map<String, String> = emptyMap(),
    val priority: Int = 0,
    val timeout: Long = 30_000L
)

@Entity(tableName = "task_log")
data class TaskLogEntity(
    @PrimaryKey val taskId: String,
    val appPackage: String,
    val functionId: String?,
    val status: TaskStatus,
    val durationMs: Long = 0L,
    val errorMessage: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val acked: Boolean = false
)

enum class TaskStatus { PENDING, RUNNING, SUCCESS, FAILED, CANCELLED }

// ─── WEBSOCKET MESSAGES ─────────────────────────────────

@Serializable
data class HeadyMessage(
    val type: String,      // "task" | "ack" | "memory_update" | "status"
    val taskId: String? = null,
    val payload: String? = null
) {
    fun toTask(): HeadyTask = kotlinx.serialization.json.Json.decodeFromString(
        payload ?: throw IllegalStateException("Task message has no payload")
    )

    companion object {
        fun statusUpdate(status: String, cslScore: Float) = HeadyMessage(
            type = "status", payload = """{"status":"$status","cslScore":$cslScore}"""
        )

        fun evalAlert(agentId: String, layers: List<String>, metrics: List<String>) = HeadyMessage(
            type = "eval_alert",
            payload = kotlinx.serialization.json.Json.encodeToString(
                kotlinx.serialization.json.JsonObject(mapOf(
                    "agentId" to kotlinx.serialization.json.JsonPrimitive(agentId),
                    "failedLayers" to kotlinx.serialization.json.JsonArray(
                        layers.map { kotlinx.serialization.json.JsonPrimitive(it) }),
                    "driftedMetrics" to kotlinx.serialization.json.JsonArray(
                        metrics.map { kotlinx.serialization.json.JsonPrimitive(it) })
                ))
            )
        )
    }
}

// ─── DEVICE PROFILE ─────────────────────────────────────

@Serializable
data class DeviceProfile(
    val deviceId: String,
    val userId: String,
    val workApps: List<String>,
    val permissionMap: List<AppPermission> = emptyList(),
    val registeredAt: Long = System.currentTimeMillis()
)

// ─── APP FUNCTION RESULTS ───────────────────────────────

sealed class AppFunctionResult {
    data class Success(val result: Any?, val durationMs: Long) : AppFunctionResult()
    data class Failed(val error: String?, val durationMs: Long) : AppFunctionResult()
    data class PermissionDenied(val appPackage: String, val taskId: String) : AppFunctionResult()
    data class FunctionNotFound(val appPackage: String, val functionId: String) : AppFunctionResult()
}

// ─── EVAL RESULTS ───────────────────────────────────────

enum class EvalLayer { OUTPUT, TRACE, COMPONENT, DRIFT }

data class EvalResult(
    val layer: EvalLayer,
    val score: Float,
    val passed: Boolean,
    val detail: String
)

data class DriftResult(
    val metric: String,
    val current: Float,
    val baseline: Float,
    val delta: Float,
    val drifted: Boolean,
    val threshold: Float = 0.10f
)

data class FullEvalReport(
    val results: List<EvalResult>,
    val driftResults: List<DriftResult>,
    val allPassed: Boolean
)

// ─── CONNECTION STATE ───────────────────────────────────

enum class ConnectionState {
    DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
}

// ─── WORK APP (for UI) ──────────────────────────────────

data class WorkApp(
    val packageName: String,
    val label: String,
    val iconUri: String?,
    val accessLevel: AccessLevel,
    val grantedAt: Long
)
