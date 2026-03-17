/**
 * TasksScreen — Task automation management
 * Schedule, monitor, and manage automated tasks.
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class BuddyTask(
    val id: String,
    val title: String,
    val description: String,
    val status: TaskStatus,
    val icon: ImageVector,
    val scheduledTime: String? = null
)

enum class TaskStatus(val label: String) {
    QUEUED("Queued"),
    RUNNING("Running"),
    COMPLETED("Done"),
    FAILED("Failed"),
    SCHEDULED("Scheduled")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen() {
    var tasks by remember {
        mutableStateOf(
            listOf(
                BuddyTask("1", "Check emails", "Scan inbox for important messages", TaskStatus.COMPLETED, Icons.Filled.Email),
                BuddyTask("2", "Research topic", "Find information about cloud computing trends", TaskStatus.RUNNING, Icons.Filled.Search),
                BuddyTask("3", "Draft message", "Compose follow-up email to team", TaskStatus.QUEUED, Icons.Filled.Edit),
                BuddyTask("4", "Daily summary", "Generate end-of-day activity report", TaskStatus.SCHEDULED, Icons.Filled.Summarize, "18:00"),
                BuddyTask("5", "Sync files", "Upload documents to cloud storage", TaskStatus.COMPLETED, Icons.Filled.CloudUpload),
            )
        )
    }
    var showNewTask by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showNewTask = true },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("New Task") },
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Header
            Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 2.dp) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Text("Task Automation", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Text(
                        "Buddy manages these tasks for you",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Stats
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        TaskStat("Active", tasks.count { it.status == TaskStatus.RUNNING }.toString(), MaterialTheme.colorScheme.primary)
                        TaskStat("Queued", tasks.count { it.status == TaskStatus.QUEUED }.toString(), MaterialTheme.colorScheme.tertiary)
                        TaskStat("Done", tasks.count { it.status == TaskStatus.COMPLETED }.toString(), MaterialTheme.colorScheme.secondary)
                    }
                }
            }

            // Task list
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(tasks, key = { it.id }) { task ->
                    TaskCard(task = task, onDismiss = {
                        tasks = tasks.filter { it.id != task.id }
                    })
                }
            }
        }
    }

    if (showNewTask) {
        var taskTitle by remember { mutableStateOf("") }
        var taskDesc by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showNewTask = false },
            title = { Text("New Task") },
            text = {
                Column {
                    OutlinedTextField(
                        value = taskTitle,
                        onValueChange = { taskTitle = it },
                        label = { Text("Task name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = taskDesc,
                        onValueChange = { taskDesc = it },
                        label = { Text("Description") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (taskTitle.isNotBlank()) {
                        tasks = tasks + BuddyTask(
                            id = System.currentTimeMillis().toString(),
                            title = taskTitle,
                            description = taskDesc,
                            status = TaskStatus.QUEUED,
                            icon = Icons.Filled.TaskAlt
                        )
                        showNewTask = false
                    }
                }) { Text("Create") }
            },
            dismissButton = {
                TextButton(onClick = { showNewTask = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
fun TaskCard(task: BuddyTask, onDismiss: () -> Unit) {
    val statusColor = when (task.status) {
        TaskStatus.RUNNING -> MaterialTheme.colorScheme.primary
        TaskStatus.COMPLETED -> MaterialTheme.colorScheme.secondary
        TaskStatus.FAILED -> MaterialTheme.colorScheme.error
        TaskStatus.QUEUED -> MaterialTheme.colorScheme.tertiary
        TaskStatus.SCHEDULED -> MaterialTheme.colorScheme.outline
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(task.icon, contentDescription = null, tint = statusColor, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(task.title, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Text(task.description, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (task.scheduledTime != null) {
                    Text("Scheduled: ${task.scheduledTime}", fontSize = 11.sp, color = statusColor)
                }
            }
            AssistChip(
                onClick = {},
                label = { Text(task.status.label, fontSize = 11.sp) },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = statusColor.copy(alpha = 0.1f),
                    labelColor = statusColor
                )
            )
        }
    }
}

@Composable
fun TaskStat(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = color)
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
