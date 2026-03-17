/**
 * Room DAO for task operations.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.headysystems.headybuddy.data.TaskExecutionStatus
import com.headysystems.headybuddy.data.entity.TaskEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {

    @Query("SELECT * FROM tasks ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE status IN (:statuses) ORDER BY createdAt DESC")
    fun observeByStatus(statuses: List<TaskExecutionStatus>): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun getById(id: String): TaskEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(task: TaskEntity)

    @Update
    suspend fun update(task: TaskEntity)

    @Query("UPDATE tasks SET status = :status, completedAt = :completedAt, result = :result WHERE id = :id")
    suspend fun complete(
        id: String,
        status: TaskExecutionStatus,
        completedAt: Long = System.currentTimeMillis(),
        result: String? = null
    )

    @Query("UPDATE tasks SET status = :status, errorMessage = :error, completedAt = :completedAt WHERE id = :id")
    suspend fun fail(
        id: String,
        status: TaskExecutionStatus = TaskExecutionStatus.FAILED,
        error: String?,
        completedAt: Long = System.currentTimeMillis()
    )

    @Query("UPDATE tasks SET status = 'CANCELLED', completedAt = :timestamp WHERE id = :id")
    suspend fun cancel(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("SELECT * FROM tasks WHERE status = 'PENDING_APPROVAL'")
    fun observePendingApproval(): Flow<List<TaskEntity>>

    @Query("UPDATE tasks SET status = 'QUEUED', approvedAt = :timestamp WHERE id = :id")
    suspend fun approve(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("SELECT * FROM tasks WHERE conversationId = :conversationId ORDER BY createdAt DESC")
    fun observeByConversation(conversationId: String): Flow<List<TaskEntity>>
}
