/**
 * HeadyBuddy Application -- Singleton entry point.
 * Initializes keystore, database, cloud connection, and work manager.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.Configuration
import androidx.work.WorkManager
import com.headysystems.buddy.core.security.HeadyDeviceIdentity
import com.headysystems.buddy.core.security.HeadyKeystore
import com.headysystems.headybuddy.data.HeadyDatabase
import com.headysystems.headybuddy.network.CloudClient
import com.headysystems.headybuddy.network.WebSocketManager

class HeadyBuddyApp : Application(), Configuration.Provider {

    lateinit var database: HeadyDatabase
        private set
    lateinit var deviceIdentity: HeadyDeviceIdentity
        private set
    lateinit var keystore: HeadyKeystore
        private set
    lateinit var cloudClient: CloudClient
        private set
    lateinit var webSocketManager: WebSocketManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize security
        keystore = HeadyKeystore.getInstance(this)
        HeadyKeystore.init(this)
        deviceIdentity = HeadyDeviceIdentity.getInstance(this)

        // Initialize database
        database = HeadyDatabase.getInstance(this)

        // Initialize network
        cloudClient = CloudClient(
            baseUrl = BuildConfig.API_BASE_URL,
            keystore = keystore,
            deviceIdentity = deviceIdentity
        )
        webSocketManager = WebSocketManager(
            wsUrl = BuildConfig.WS_URL,
            deviceIdentity = deviceIdentity,
            keystore = keystore
        )

        // Create notification channels
        createNotificationChannels()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            // Service channel
            val serviceChannel = NotificationChannel(
                CHANNEL_SERVICE,
                "HeadyBuddy Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps HeadyBuddy running for always-on AI assistance"
                setShowBadge(false)
            }

            // Chat channel
            val chatChannel = NotificationChannel(
                CHANNEL_CHAT,
                "Chat Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new chat messages and responses"
                enableVibration(true)
            }

            // Task channel
            val taskChannel = NotificationChannel(
                CHANNEL_TASKS,
                "Task Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Status updates for automated tasks"
            }

            // Work profile channel
            val workChannel = NotificationChannel(
                CHANNEL_WORK_PROFILE,
                "Work Profile",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Work profile management notifications"
            }

            manager.createNotificationChannels(
                listOf(serviceChannel, chatChannel, taskChannel, workChannel)
            )
        }
    }

    companion object {
        const val CHANNEL_SERVICE = "heady_buddy_service"
        const val CHANNEL_CHAT = "heady_buddy_chat"
        const val CHANNEL_TASKS = "heady_buddy_tasks"
        const val CHANNEL_WORK_PROFILE = "heady_buddy_work"

        @Volatile
        private var instance: HeadyBuddyApp? = null

        fun getInstance(): HeadyBuddyApp =
            instance ?: throw IllegalStateException("HeadyBuddyApp not initialized")
    }
}
