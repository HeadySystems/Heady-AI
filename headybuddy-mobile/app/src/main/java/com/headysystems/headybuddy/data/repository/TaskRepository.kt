/**
 * Task Repository -- manages automated task lifecycle.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.repository

import com.headysystems.headybuddy.data.TaskExecutionStatus
import com.headysystems.headybuddy.data.dao.TaskDao
import com.headysystems.headybuddy.data.entity.TaskEntity
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class TaskRepository(
    private val taskDao: TaskDao,
) {

    fun observeAllTasks(): Flow<List<TaskEntity>> = taskDao.observeAll()

    fun observeActiveTasks(): Flow<List<TaskEntity>> =
        taskDao.observeByStatus(
            listOf(TaskExecutionStatus.QUEUED, TaskExecutionStatus.RUNNING, TaskExecutionStatus.PENDING_APPROVAL)
        )

    fun observePendingApproval(): Flow<List<TaskEntity>> =
        taskDao.observePendingApproval()

    fun observeByConversation(conversationId: String): Flow<List<TaskEntity>> =
        taskDao.observeByConversation(conversationId)

    suspend fun createTask(
        type: String,
        title: String,
        description: String,
        targetApp: String? = null,
        params: String? = null,
        requiresApproval: Boolean = true,
        conversationId: String? = null
    ): String {
        val id = UUID.randomUUID().toString()
        val status = if (requiresApproval) TaskExecutionStatus.PENDING_APPROVAL
                     else TaskExecutionStatus.QUEUED
        taskDao.insert(
            TaskEntity(
                id = id,
                type = type,
                title = title,
                description = description,
                status = status,
                targetApp = targetApp,
                params = params,
                requiresApproval = requiresApproval,
                conversationId = conversationId
            )
        )
        return id
    }

    suspend fun approveTask(taskId: String) {
        taskDao.approve(taskId)
    }

    suspend fun cancelTask(taskId: String) {
        taskDao.cancel(taskId)
    }

    suspend fun startTask(taskId: String) {
        taskDao.getById(taskId)?.let { task ->
            taskDao.update(
                task.copy(
                    status = TaskExecutionStatus.RUNNING,
                    startedAt = System.currentTimeMillis()
                )
            )
        }
    }

    suspend fun completeTask(taskId: String, result: String?) {
        taskDao.complete(
            id = taskId,
            status = TaskExecutionStatus.COMPLETED,
            result = result
        )
    }

    suspend fun failTask(taskId: String, error: String?) {
        taskDao.fail(id = taskId, error = error)
    }
}
