/**
 * Conversation entity for Room persistence.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey val id: String,
    val title: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val messageCount: Int = 0,
    val synced: Boolean = false,
    val archived: Boolean = false
)
