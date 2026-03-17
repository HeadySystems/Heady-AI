/**
 * Room type converters for HeadyBuddy database.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data

import androidx.room.TypeConverter

class Converters {

    @TypeConverter
    fun fromStringList(value: List<String>?): String? =
        value?.joinToString(separator = "|||")

    @TypeConverter
    fun toStringList(value: String?): List<String>? =
        value?.split("|||")?.filter { it.isNotEmpty() }

    @TypeConverter
    fun fromMessageRole(role: MessageRole): String = role.name

    @TypeConverter
    fun toMessageRole(value: String): MessageRole = MessageRole.valueOf(value)

    @TypeConverter
    fun fromTaskStatus(status: TaskExecutionStatus): String = status.name

    @TypeConverter
    fun toTaskStatus(value: String): TaskExecutionStatus = TaskExecutionStatus.valueOf(value)
}

enum class MessageRole {
    USER, BUDDY, SYSTEM
}

enum class TaskExecutionStatus {
    QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED, PENDING_APPROVAL
}
