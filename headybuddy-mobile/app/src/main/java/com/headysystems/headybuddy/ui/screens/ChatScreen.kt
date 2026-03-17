/**
 * ChatScreen — Main HeadyBuddy chat interface
 * Natural language interaction with streaming AI responses.
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.headysystems.headybuddy.HeadyBuddyApp
import kotlinx.coroutines.launch

data class ChatMessage(
    val content: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen() {
    var inputText by remember { mutableStateOf("") }
    var messages by remember { mutableStateOf(listOf<ChatMessage>()) }
    var isThinking by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    val quickActions = listOf("What can you do?", "Check my tasks", "Open settings", "Help me automate")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Header
        Surface(
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 2.dp,
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Avatar
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text("H", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text("HeadyBuddy", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    Text(
                        if (isThinking) "Thinking..." else "Online • Ready to help",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Messages
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            if (messages.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            "Welcome to HeadyBuddy",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Your AI companion for everything digital",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(24.dp))

                        // Quick actions
                        quickActions.forEach { action ->
                            OutlinedButton(
                                onClick = {
                                    messages = messages + ChatMessage(action, isUser = true)
                                    isThinking = true
                                    // Cloud response would come from WebSocket
                                    messages = messages + ChatMessage(
                                        "I'd be happy to help with that! Let me connect to Heady Cloud...",
                                        isUser = false
                                    )
                                    isThinking = false
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(action)
                            }
                        }
                    }
                }
            }

            items(messages) { message ->
                AnimatedVisibility(
                    visible = true,
                    enter = fadeIn() + slideInVertically { it / 2 }
                ) {
                    ChatBubble(message)
                }
            }

            if (isThinking) {
                item {
                    Row(
                        modifier = Modifier.padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Thinking...", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        // Input bar
        Surface(
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 3.dp,
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Voice input
                IconButton(onClick = { /* Voice input */ }) {
                    Icon(Icons.Filled.Mic, contentDescription = "Voice Input")
                }

                // Text input
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Ask Buddy anything...") },
                    shape = RoundedCornerShape(24.dp),
                    singleLine = false,
                    maxLines = 4,
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Send button
                FilledIconButton(
                    onClick = {
                        if (inputText.isNotBlank()) {
                            val text = inputText.trim()
                            inputText = ""
                            messages = messages + ChatMessage(text, isUser = true)
                            isThinking = true
                            scope.launch {
                                try {
                                    val app = HeadyBuddyApp.getInstance()
                                    val reply = app.cloudClient.sendChat(text, messages.takeLast(10))
                                    messages = messages + ChatMessage(reply, isUser = false)
                                } catch (e: Exception) {
                                    messages = messages + ChatMessage(
                                        "Connection issue — I'll keep trying. (${e.message})",
                                        isUser = false
                                    )
                                }
                                isThinking = false
                                listState.animateScrollToItem(messages.size)
                            }
                        }
                    },
                    enabled = inputText.isNotBlank()
                ) {
                    Icon(Icons.Filled.Send, contentDescription = "Send")
                }
            }
        }
    }
}

@Composable
fun ChatBubble(message: ChatMessage) {
    val alignment = if (message.isUser) Alignment.End else Alignment.Start
    val bgColor = if (message.isUser)
        MaterialTheme.colorScheme.primaryContainer
    else
        MaterialTheme.colorScheme.surfaceVariant
    val textColor = if (message.isUser)
        MaterialTheme.colorScheme.onPrimaryContainer
    else
        MaterialTheme.colorScheme.onSurfaceVariant

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Surface(
            color = bgColor,
            shape = RoundedCornerShape(
                topStart = 16.dp, topEnd = 16.dp,
                bottomStart = if (message.isUser) 16.dp else 4.dp,
                bottomEnd = if (message.isUser) 4.dp else 16.dp,
            ),
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Text(
                text = message.content,
                modifier = Modifier.padding(12.dp),
                color = textColor,
                fontSize = 14.sp
            )
        }
    }
}
