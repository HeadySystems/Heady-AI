/**
 * HeadyDeviceAdminReceiver — Work Profile management (Island-like pattern)
 * Manages the work profile where Buddy operates and interacts with cloned apps.
 * (c) 2026 HeadySystems Inc.
 */
package com.headysystems.headybuddy.work

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.UserHandle
import android.util.Log
import android.widget.Toast

class HeadyDeviceAdminReceiver : DeviceAdminReceiver() {

    companion object {
        private const val TAG = "HeadyAdmin"

        fun getComponentName(context: Context): ComponentName =
            ComponentName(context, HeadyDeviceAdminReceiver::class.java)

        fun isProfileOwner(context: Context): Boolean {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            return dpm.isProfileOwnerApp(context.packageName)
        }

        fun isDeviceOwner(context: Context): Boolean {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            return dpm.isDeviceOwnerApp(context.packageName)
        }
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device admin enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.i(TAG, "Device admin disabled")
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        Log.i(TAG, "Work profile provisioning complete")

        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val cn = getComponentName(context)

        // Enable the work profile
        dpm.setProfileEnabled(cn)

        // Set profile name
        dpm.setOrganizationName(cn, "HeadyBuddy Work")

        // Allow cross-profile communication
        try {
            dpm.setCrossProfileCallerIdDisabled(cn, false)
            dpm.setCrossProfileContactsSearchDisabled(cn, false)
        } catch (e: Exception) {
            Log.w(TAG, "Cross-profile setup: ${e.message}")
        }

        Toast.makeText(context, "HeadyBuddy Work Profile ready", Toast.LENGTH_LONG).show()
    }
}
