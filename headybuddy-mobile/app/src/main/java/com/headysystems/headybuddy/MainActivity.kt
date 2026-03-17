/**
 * MainActivity — HeadyBuddy Android Entry Point
 * Compose-based navigation with Sacred Geometry theme.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.headysystems.headybuddy.ui.screens.ChatScreen
import com.headysystems.headybuddy.ui.screens.WorkProfileScreen
import com.headysystems.headybuddy.ui.screens.TasksScreen
import com.headysystems.headybuddy.ui.screens.SettingsScreen
import com.headysystems.headybuddy.ui.components.BuddyBottomBar
import com.headysystems.headybuddy.ui.theme.HeadyBuddyTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            HeadyBuddyTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    BuddyNavHost()
                }
            }
        }
    }
}

@Composable
fun BuddyNavHost() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            BuddyBottomBar(
                currentRoute = currentRoute ?: "chat",
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo("chat") { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "chat",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("chat") { ChatScreen() }
            composable("work") { WorkProfileScreen() }
            composable("tasks") { TasksScreen() }
            composable("settings") { SettingsScreen() }
        }
    }
}
