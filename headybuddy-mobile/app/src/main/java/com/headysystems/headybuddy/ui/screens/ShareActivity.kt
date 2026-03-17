/**
 * ShareActivity — Receive shared content and forward to HeadyBuddy
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.ui.screens

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.headysystems.headybuddy.HeadyBuddyApp
import com.headysystems.headybuddy.ui.theme.HeadyBuddyTheme
import kotlinx.coroutines.launch

class ShareActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sharedText = when (intent?.action) {
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""
            else -> ""
        }

        setContent {
            HeadyBuddyTheme {
                ShareScreen(
                    sharedContent = sharedText,
                    onSend = { message ->
                        // Send to buddy and close
                        finish()
                    },
                    onDismiss = { finish() }
                )
            }
        }
    }
}

@Composable
fun ShareScreen(sharedContent: String, onSend: (String) -> Unit, onDismiss: () -> Unit) {
    var prompt by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Ask HeadyBuddy", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(16.dp))

            // Shared content preview
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = sharedContent.take(200) + if (sharedContent.length > 200) "..." else "",
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = prompt,
                onValueChange = { prompt = it },
                label = { Text("What should Buddy do with this?") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                    Text("Cancel")
                }
                Button(
                    onClick = {
                        scope.launch {
                            val fullMessage = if (prompt.isNotBlank())
                                "$prompt\n\nShared content: $sharedContent"
                            else "Help me with: $sharedContent"
                            onSend(fullMessage)
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Ask Buddy")
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Quick actions for shared content
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = { onSend("Summarize this: $sharedContent") }, label = { Text("Summarize") })
                AssistChip(onClick = { onSend("Translate this: $sharedContent") }, label = { Text("Translate") })
                AssistChip(onClick = { onSend("Explain this: $sharedContent") }, label = { Text("Explain") })
            }
        }
    }
}
