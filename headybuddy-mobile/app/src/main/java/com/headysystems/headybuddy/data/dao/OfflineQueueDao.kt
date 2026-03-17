/**
 * Room DAO for offline queue operations.
 * Fibonacci-scaled retry backoff for queued actions.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.headysystems.headybuddy.data.entity.OfflineQueueEntry

@Dao
interface OfflineQueueDao {

    @Query("SELECT * FROM offline_queue WHERE processed = 0 AND nextRetryAt <= :now ORDER BY createdAt ASC")
    suspend fun getPending(now: Long = System.currentTimeMillis()): List<OfflineQueueEntry>

    @Insert
    suspend fun insert(entry: OfflineQueueEntry)

    @Query("UPDATE offline_queue SET processed = 1 WHERE id = :id")
    suspend fun markProcessed(id: Long)

    @Query("UPDATE offline_queue SET retryCount = retryCount + 1, nextRetryAt = :nextRetryAt WHERE id = :id")
    suspend fun incrementRetry(id: Long, nextRetryAt: Long)

    @Query("DELETE FROM offline_queue WHERE processed = 1")
    suspend fun clearProcessed()

    @Query("SELECT COUNT(*) FROM offline_queue WHERE processed = 0")
    suspend fun pendingCount(): Int
}
