/**
 * WorkProfileScreen — Island-like work profile for HeadyBuddy
 * Buddy operates in a managed space, user can clone apps for Buddy to interact with.
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class WorkApp(
    val name: String,
    val icon: ImageVector,
    val isCloned: Boolean = false,
    val isRunning: Boolean = false,
    val description: String = ""
)

@Composable
fun WorkProfileScreen() {
    var showAddDialog by remember { mutableStateOf(false) }
    var workApps by remember {
        mutableStateOf(
            listOf(
                WorkApp("Browser", Icons.Filled.Language, isCloned = true, isRunning = true, description = "Web browsing tasks"),
                WorkApp("Email", Icons.Filled.Email, isCloned = true, description = "Email management"),
                WorkApp("Files", Icons.Filled.Folder, isCloned = true, description = "File operations"),
                WorkApp("Calendar", Icons.Filled.CalendarToday, description = "Schedule management"),
                WorkApp("Messages", Icons.Filled.Message, description = "Messaging automation"),
                WorkApp("Notes", Icons.Filled.Note, isCloned = true, description = "Note taking"),
            )
        )
    }

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
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Work Profile", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            "Buddy's workspace for automated tasks",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    FilledTonalButton(onClick = { showAddDialog = true }) {
                        Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Clone App")
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Status card
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        StatusChip("Cloned", workApps.count { it.isCloned }.toString(), Icons.Filled.ContentCopy)
                        StatusChip("Running", workApps.count { it.isRunning }.toString(), Icons.Filled.PlayArrow)
                        StatusChip("Tasks", "3", Icons.Filled.TaskAlt)
                    }
                }
            }
        }

        // App Grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(workApps) { app ->
                WorkAppCard(
                    app = app,
                    onToggleClone = {
                        workApps = workApps.map {
                            if (it.name == app.name) it.copy(isCloned = !it.isCloned)
                            else it
                        }
                    }
                )
            }
        }

        // Permissions info
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Security,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Work Profile Isolation", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Apps in the work profile are sandboxed. Buddy can only interact with cloned apps and requires your permission for sensitive actions.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 18.sp
                )
            }
        }
    }

    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Clone App to Work Profile") },
            text = { Text("Select an installed app to clone into Buddy's work profile. Buddy will be able to interact with the cloned copy.") },
            confirmButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Browse Apps")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun WorkAppCard(app: WorkApp, onToggleClone: () -> Unit) {
    Card(
        onClick = onToggleClone,
        colors = CardDefaults.cardColors(
            containerColor = if (app.isCloned)
                MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.6f)
            else
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(
                        if (app.isCloned) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                        else MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    app.icon,
                    contentDescription = app.name,
                    tint = if (app.isCloned) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                app.name,
                fontSize = 12.sp,
                fontWeight = if (app.isCloned) FontWeight.Medium else FontWeight.Normal,
                textAlign = TextAlign.Center,
                maxLines = 1
            )
            if (app.isRunning) {
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                )
            }
        }
    }
}

@Composable
fun StatusChip(label: String, value: String, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(modifier = Modifier.width(4.dp))
        Text(value, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        Spacer(modifier = Modifier.width(2.dp))
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
