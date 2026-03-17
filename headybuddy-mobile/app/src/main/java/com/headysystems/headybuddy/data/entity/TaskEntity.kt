/**
 * Task entity for tracking automated task execution.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.headysystems.headybuddy.data.TaskExecutionStatus

@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val type: String,
    val title: String,
    val description: String,
    val status: TaskExecutionStatus = TaskExecutionStatus.QUEUED,
    val targetApp: String? = null,
    val params: String? = null,
    val result: String? = null,
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val startedAt: Long? = null,
    val completedAt: Long? = null,
    val requiresApproval: Boolean = false,
    val approvedAt: Long? = null,
    val conversationId: String? = null
)
