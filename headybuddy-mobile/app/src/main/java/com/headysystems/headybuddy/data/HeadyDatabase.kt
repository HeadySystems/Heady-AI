/**
 * HeadyBuddy Room Database -- Single source of truth for local persistence.
 * Tables: conversations, messages, tasks, memory, offline queue.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.headysystems.headybuddy.data.dao.ConversationDao
import com.headysystems.headybuddy.data.dao.MessageDao
import com.headysystems.headybuddy.data.dao.TaskDao
import com.headysystems.headybuddy.data.dao.OfflineQueueDao
import com.headysystems.headybuddy.data.entity.ConversationEntity
import com.headysystems.headybuddy.data.entity.MessageEntity
import com.headysystems.headybuddy.data.entity.TaskEntity
import com.headysystems.headybuddy.data.entity.OfflineQueueEntry

@Database(
    entities = [
        ConversationEntity::class,
        MessageEntity::class,
        TaskEntity::class,
        OfflineQueueEntry::class,
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class HeadyDatabase : RoomDatabase() {

    abstract fun conversationDao(): ConversationDao
    abstract fun messageDao(): MessageDao
    abstract fun taskDao(): TaskDao
    abstract fun offlineQueueDao(): OfflineQueueDao

    companion object {
        private const val DB_NAME = "heady_buddy.db"

        @Volatile
        private var instance: HeadyDatabase? = null

        fun getInstance(context: Context): HeadyDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    HeadyDatabase::class.java,
                    DB_NAME
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
