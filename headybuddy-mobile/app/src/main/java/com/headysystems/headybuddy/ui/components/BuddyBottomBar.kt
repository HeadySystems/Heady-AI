package com.headysystems.headybuddy.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector

data class BottomNavItem(val route: String, val label: String, val icon: ImageVector)

private val navItems = listOf(
    BottomNavItem("chat", "Chat", Icons.Filled.Chat),
    BottomNavItem("work", "Work", Icons.Filled.Work),
    BottomNavItem("tasks", "Tasks", Icons.Filled.TaskAlt),
    BottomNavItem("settings", "Settings", Icons.Filled.Settings),
)

@Composable
fun BuddyBottomBar(currentRoute: String, onNavigate: (String) -> Unit) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        navItems.forEach { item ->
            NavigationBarItem(
                selected = currentRoute == item.route,
                onClick = { onNavigate(item.route) },
                icon = { Icon(item.icon, contentDescription = item.label) },
                label = { Text(item.label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                )
            )
        }
    }
}
