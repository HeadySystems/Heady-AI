/**
 * Offline queue entry for actions pending network connectivity.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "offline_queue")
data class OfflineQueueEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val action: String,
    val payload: String,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0,
    val maxRetries: Int = 8,
    val nextRetryAt: Long = 0L,
    val processed: Boolean = false
)
