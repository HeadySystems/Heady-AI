/**
 * SettingsScreen — HeadyBuddy configuration with granular permissions
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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

@Composable
fun SettingsScreen() {
    var taskAutomation by remember { mutableStateOf(true) }
    var voiceInput by remember { mutableStateOf(true) }
    var screenAssist by remember { mutableStateOf(false) }
    var autoStart by remember { mutableStateOf(true) }
    var cloudSync by remember { mutableStateOf(true) }
    var notifications by remember { mutableStateOf(true) }
    var workProfile by remember { mutableStateOf(true) }
    var biometricAuth by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // Header
        Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 2.dp) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Settings", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Text(
                    "Configure HeadyBuddy's capabilities and permissions",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Account
        SettingsSection("Account") {
            SettingsItem(
                icon = Icons.Filled.Person,
                title = "Heady Account",
                subtitle = "Sign in to sync across devices",
                onClick = {}
            )
            SettingsItem(
                icon = Icons.Filled.Devices,
                title = "Connected Devices",
                subtitle = "Manage synced devices",
                onClick = {}
            )
        }

        // Permissions
        SettingsSection("Permissions") {
            SettingsToggle(
                icon = Icons.Filled.AutoFixHigh,
                title = "Task Automation",
                subtitle = "Allow Buddy to perform tasks on your behalf",
                checked = taskAutomation,
                onToggle = { taskAutomation = it }
            )
            SettingsToggle(
                icon = Icons.Filled.Mic,
                title = "Voice Input",
                subtitle = "Enable voice commands and dictation",
                checked = voiceInput,
                onToggle = { voiceInput = it }
            )
            SettingsToggle(
                icon = Icons.Filled.ScreenSearchDesktop,
                title = "Screen Assist",
                subtitle = "Allow Buddy to read screen content for context",
                checked = screenAssist,
                onToggle = { screenAssist = it }
            )
            SettingsToggle(
                icon = Icons.Filled.Work,
                title = "Work Profile",
                subtitle = "Enable isolated work profile for app automation",
                checked = workProfile,
                onToggle = { workProfile = it }
            )
        }

        // System
        SettingsSection("System") {
            SettingsToggle(
                icon = Icons.Filled.PowerSettingsNew,
                title = "Auto-Start",
                subtitle = "Start HeadyBuddy when device boots",
                checked = autoStart,
                onToggle = { autoStart = it }
            )
            SettingsToggle(
                icon = Icons.Filled.Cloud,
                title = "Cloud Sync",
                subtitle = "Sync conversations and settings via Heady Cloud",
                checked = cloudSync,
                onToggle = { cloudSync = it }
            )
            SettingsToggle(
                icon = Icons.Filled.Notifications,
                title = "Notifications",
                subtitle = "Receive proactive suggestions and task updates",
                checked = notifications,
                onToggle = { notifications = it }
            )
            SettingsToggle(
                icon = Icons.Filled.Fingerprint,
                title = "Biometric Auth",
                subtitle = "Require biometrics for sensitive actions",
                checked = biometricAuth,
                onToggle = { biometricAuth = it }
            )
        }

        // About
        SettingsSection("About") {
            SettingsItem(
                icon = Icons.Filled.Info,
                title = "Version",
                subtitle = "HeadyBuddy v3.1.0 (Pocket Lattice)",
                onClick = {}
            )
            SettingsItem(
                icon = Icons.Filled.Description,
                title = "Privacy Policy",
                subtitle = "headysystems.com/privacy",
                onClick = {}
            )
            SettingsItem(
                icon = Icons.Filled.Code,
                title = "Cloud Endpoint",
                subtitle = "manager.headysystems.com",
                onClick = {}
            )
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            title,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary
        )
        Card(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
        ) {
            Column { content() }
        }
        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
fun SettingsItem(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Surface(onClick = onClick, color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0f)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(22.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Filled.ChevronRight, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.outline)
        }
    }
}

@Composable
fun SettingsToggle(icon: ImageVector, title: String, subtitle: String, checked: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(22.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onToggle)
    }
}
