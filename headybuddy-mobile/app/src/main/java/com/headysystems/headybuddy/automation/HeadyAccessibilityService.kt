/**
 * HeadyAccessibilityService — Task automation via Android Accessibility
 * Allows Buddy to interact with apps in the work profile on behalf of the user.
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.automation

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class HeadyAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "HeadyA11y"
        var instance: HeadyAccessibilityService? = null
            private set
        var isEnabled: Boolean = false
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        isEnabled = true

        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = flags or
                    AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                    AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
                    AccessibilityServiceInfo.FLAG_REQUEST_ENHANCED_WEB_ACCESSIBILITY
            notificationTimeout = 100
        }

        Log.i(TAG, "HeadyBuddy Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        // Only process events from work profile apps (controlled by task queue)
        // Log significant events for task automation context
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                Log.d(TAG, "Window changed: ${event.packageName} - ${event.className}")
            }
            AccessibilityEvent.TYPE_VIEW_CLICKED -> {
                Log.d(TAG, "Click: ${event.packageName}")
            }
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        isEnabled = false
        Log.i(TAG, "Accessibility service destroyed")
    }

    // --- Task Execution Methods ---

    fun clickNode(nodeInfo: AccessibilityNodeInfo): Boolean {
        return nodeInfo.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    fun setTextNode(nodeInfo: AccessibilityNodeInfo, text: String): Boolean {
        val args = android.os.Bundle()
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        return nodeInfo.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    fun scrollNode(nodeInfo: AccessibilityNodeInfo, forward: Boolean): Boolean {
        val action = if (forward) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                     else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        return nodeInfo.performAction(action)
    }

    fun findNodeByText(text: String): List<AccessibilityNodeInfo> {
        val root = rootInActiveWindow ?: return emptyList()
        val nodes = root.findAccessibilityNodeInfosByText(text)
        return nodes?.toList() ?: emptyList()
    }

    fun findNodeById(viewId: String): List<AccessibilityNodeInfo> {
        val root = rootInActiveWindow ?: return emptyList()
        val nodes = root.findAccessibilityNodeInfosByViewId(viewId)
        return nodes?.toList() ?: emptyList()
    }

    fun goBack(): Boolean = performGlobalAction(GLOBAL_ACTION_BACK)
    fun goHome(): Boolean = performGlobalAction(GLOBAL_ACTION_HOME)
    fun openRecents(): Boolean = performGlobalAction(GLOBAL_ACTION_RECENTS)
    fun openNotifications(): Boolean = performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
}
