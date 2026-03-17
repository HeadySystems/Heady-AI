/**
 * Chat Repository -- mediates between ViewModel, local DB, and cloud API.
 * Implements offline-first pattern with sync queue.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.data.repository

import com.headysystems.headybuddy.data.MessageRole
import com.headysystems.headybuddy.data.dao.ConversationDao
import com.headysystems.headybuddy.data.dao.MessageDao
import com.headysystems.headybuddy.data.dao.OfflineQueueDao
import com.headysystems.headybuddy.data.entity.ConversationEntity
import com.headysystems.headybuddy.data.entity.MessageEntity
import com.headysystems.headybuddy.data.entity.OfflineQueueEntry
import com.headysystems.headybuddy.network.CloudClient
import com.headysystems.headybuddy.network.WebSocketManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class ChatRepository(
    private val conversationDao: ConversationDao,
    private val messageDao: MessageDao,
    private val offlineQueueDao: OfflineQueueDao,
    private val cloudClient: CloudClient,
    private val webSocketManager: WebSocketManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _isStreaming = MutableStateFlow(false)
    val isStreaming: StateFlow<Boolean> = _isStreaming.asStateFlow()

    /** Observe all non-archived conversations */
    fun observeConversations(): Flow<List<ConversationEntity>> =
        conversationDao.observeAll()

    /** Observe messages for a given conversation */
    fun observeMessages(conversationId: String): Flow<List<MessageEntity>> =
        messageDao.observeByConversation(conversationId)

    /** Create a new conversation and return its ID */
    suspend fun createConversation(title: String = "New Chat"): String {
        val id = UUID.randomUUID().toString()
        conversationDao.insert(
            ConversationEntity(id = id, title = title)
        )
        return id
    }

    /** Send a user message and get a streamed Buddy response */
    suspend fun sendMessage(conversationId: String, content: String) {
        // 1. Save user message locally
        val userMsgId = UUID.randomUUID().toString()
        messageDao.insert(
            MessageEntity(
                id = userMsgId,
                conversationId = conversationId,
                role = MessageRole.USER,
                content = content
            )
        )
        conversationDao.incrementMessageCount(conversationId)

        // 2. Create placeholder for Buddy response
        val buddyMsgId = UUID.randomUUID().toString()
        messageDao.insert(
            MessageEntity(
                id = buddyMsgId,
                conversationId = conversationId,
                role = MessageRole.BUDDY,
                content = "",
                isStreaming = true
            )
        )
        conversationDao.incrementMessageCount(conversationId)

        // 3. Stream response from cloud
        _isStreaming.value = true
        try {
            val history = messageDao.getByConversation(conversationId)
                .filter { it.id != buddyMsgId }
                .map { ChatMessage(role = it.role.name.lowercase(), content = it.content) }

            cloudClient.streamChat(
                conversationId = conversationId,
                messages = history,
                onChunk = { chunk ->
                    scope.launch {
                        val current = messageDao.getById(buddyMsgId)
                        val updated = (current?.content ?: "") + chunk
                        messageDao.updateContent(buddyMsgId, updated, isStreaming = true)
                    }
                },
                onComplete = { fullResponse ->
                    scope.launch {
                        messageDao.updateContent(buddyMsgId, fullResponse, isStreaming = false)
                        _isStreaming.value = false

                        // Update conversation title if it's the first exchange
                        val count = messageDao.countByConversation(conversationId)
                        if (count <= 2) {
                            val title = content.take(50).let {
                                if (content.length > 50) "$it..." else it
                            }
                            conversationDao.getById(conversationId)?.let { conv ->
                                conversationDao.update(conv.copy(title = title))
                            }
                        }
                    }
                },
                onError = { error ->
                    scope.launch {
                        messageDao.updateContent(
                            buddyMsgId,
                            "I'm having trouble connecting right now. Your message has been queued.",
                            isStreaming = false
                        )
                        _isStreaming.value = false

                        // Queue for retry
                        offlineQueueDao.insert(
                            OfflineQueueEntry(
                                action = "send_message",
                                payload = """{"conversationId":"$conversationId","content":"$content"}"""
                            )
                        )
                    }
                }
            )
        } catch (e: Exception) {
            _isStreaming.value = false
            messageDao.updateContent(
                buddyMsgId,
                "Connection unavailable. Your message has been queued for when connectivity returns.",
                isStreaming = false
            )
            offlineQueueDao.insert(
                OfflineQueueEntry(
                    action = "send_message",
                    payload = """{"conversationId":"$conversationId","content":"$content"}"""
                )
            )
        }
    }

    /** Archive a conversation */
    suspend fun archiveConversation(conversationId: String) {
        conversationDao.archive(conversationId)
    }

    /** Delete a conversation and all its messages */
    suspend fun deleteConversation(conversationId: String) {
        conversationDao.delete(conversationId)
    }
}

data class ChatMessage(val role: String, val content: String)
