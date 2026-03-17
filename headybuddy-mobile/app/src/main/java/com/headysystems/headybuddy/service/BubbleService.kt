/**
 * BubbleService — Floating AI chat bubble overlay (like chat heads)
 * Provides always-accessible Buddy interaction without opening the full app.
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.*
import android.widget.FrameLayout
import androidx.core.app.NotificationCompat
import com.headysystems.headybuddy.HeadyBuddyApp
import com.headysystems.headybuddy.MainActivity
import com.headysystems.headybuddy.R
import kotlin.math.abs

class BubbleService : Service() {

    private var windowManager: WindowManager? = null
    private var bubbleView: View? = null
    private var isExpanded = false

    companion object {
        private const val NOTIFICATION_ID = 2002
        private const val BUBBLE_SIZE = 56 // dp
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createBubble()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())
        return START_STICKY
    }

    private fun createNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, HeadyBuddyApp.CHANNEL_SERVICE)
            .setContentTitle("HeadyBuddy")
            .setContentText("Bubble active - tap to open")
            .setSmallIcon(R.drawable.ic_heady_notification)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun createBubble() {
        val density = resources.displayMetrics.density
        val sizePx = (BUBBLE_SIZE * density).toInt()

        val params = WindowManager.LayoutParams(
            sizePx, sizePx,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = (resources.displayMetrics.widthPixels - sizePx - (16 * density).toInt())
            y = (resources.displayMetrics.heightPixels / 2)
        }

        bubbleView = FrameLayout(this).apply {
            setBackgroundResource(R.drawable.ic_heady_notification)
            alpha = 0.9f
        }

        // Touch handling for drag + tap
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var moved = false

        bubbleView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initialX + (event.rawX - initialTouchX).toInt()
                    params.y = initialY + (event.rawY - initialTouchY).toInt()
                    windowManager?.updateViewLayout(bubbleView, params)
                    if (abs(event.rawX - initialTouchX) > 10 || abs(event.rawY - initialTouchY) > 10) {
                        moved = true
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        // Tap - open the main app
                        val intent = Intent(this@BubbleService, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        }
                        startActivity(intent)
                    }
                    true
                }
                else -> false
            }
        }

        try {
            windowManager?.addView(bubbleView, params)
        } catch (e: Exception) {
            // Overlay permission not granted
            stopSelf()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        bubbleView?.let { windowManager?.removeView(it) }
        bubbleView = null
    }
}
