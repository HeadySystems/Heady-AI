/**
 * Room DAO for chat message operations.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.headysystems.headybuddy.data.entity.MessageEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY timestamp ASC")
    fun observeByConversation(conversationId: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY timestamp ASC")
    suspend fun getByConversation(conversationId: String): List<MessageEntity>

    @Query("SELECT * FROM messages WHERE id = :id")
    suspend fun getById(id: String): MessageEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: MessageEntity)

    @Update
    suspend fun update(message: MessageEntity)

    @Query("DELETE FROM messages WHERE id = :id")
    suspend fun delete(id: String)

    @Query("UPDATE messages SET content = :content, isStreaming = :isStreaming WHERE id = :id")
    suspend fun updateContent(id: String, content: String, isStreaming: Boolean)

    @Query("SELECT * FROM messages WHERE synced = 0")
    suspend fun getUnsynced(): List<MessageEntity>

    @Query("UPDATE messages SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("SELECT COUNT(*) FROM messages WHERE conversationId = :conversationId")
    suspend fun countByConversation(conversationId: String): Int
}
