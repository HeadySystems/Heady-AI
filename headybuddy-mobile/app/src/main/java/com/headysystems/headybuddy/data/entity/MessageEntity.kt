/**
 * Chat message entity for Room persistence.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.headysystems.headybuddy.data.MessageRole

@Entity(
    tableName = "messages",
    foreignKeys = [
        ForeignKey(
            entity = ConversationEntity::class,
            parentColumns = ["id"],
            childColumns = ["conversationId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("conversationId")]
)
data class MessageEntity(
    @PrimaryKey val id: String,
    val conversationId: String,
    val role: MessageRole,
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isStreaming: Boolean = false,
    val synced: Boolean = false,
    val metadata: String? = null
)
