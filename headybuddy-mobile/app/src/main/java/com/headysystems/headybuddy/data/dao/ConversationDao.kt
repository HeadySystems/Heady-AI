/**
 * Room DAO for conversation operations.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.headysystems.headybuddy.data.entity.ConversationEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ConversationDao {

    @Query("SELECT * FROM conversations WHERE archived = 0 ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE id = :id")
    suspend fun getById(id: String): ConversationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(conversation: ConversationEntity)

    @Update
    suspend fun update(conversation: ConversationEntity)

    @Query("UPDATE conversations SET archived = 1, updatedAt = :timestamp WHERE id = :id")
    suspend fun archive(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM conversations WHERE id = :id")
    suspend fun delete(id: String)

    @Query("UPDATE conversations SET messageCount = messageCount + 1, updatedAt = :timestamp WHERE id = :id")
    suspend fun incrementMessageCount(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("SELECT * FROM conversations WHERE synced = 0")
    suspend fun getUnsynced(): List<ConversationEntity>

    @Query("UPDATE conversations SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)
}
