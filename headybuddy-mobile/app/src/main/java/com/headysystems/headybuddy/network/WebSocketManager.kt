/**
 * WebSocket Manager -- Persistent WSS connection to Heady Manager.
 * Handles challenge-response auth, reconnection with Fibonacci backoff,
 * and phi-scaled heartbeat (29,034ms).
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.network

import android.util.Log
import com.headysystems.buddy.core.security.HeadyDeviceIdentity
import com.headysystems.buddy.core.security.HeadyKeystore
import com.headysystems.buddy.core.models.ConnectionState
import com.headysystems.buddy.core.models.HeadyMessage
import com.headysystems.headybuddy.ui.theme.SacredGeometry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class WebSocketManager(
    private val wsUrl: String,
    private val deviceIdentity: HeadyDeviceIdentity,
    private val keystore: HeadyKeystore,
) {
    companion object {
        private const val TAG = "HeadyWS"
        private const val HEARTBEAT_MS = SacredGeometry.PHI_7_HEARTBEAT_MS
        private const val MAX_RECONNECT_ATTEMPTS = 13 // Fibonacci number
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var reconnectAttempt = 0

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _messages = MutableSharedFlow<HeadyMessage>(replay = 0, extraBufferCapacity = 64)
    val messages: SharedFlow<HeadyMessage> = _messages.asSharedFlow()

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MINUTES) // No read timeout for WebSocket
        .writeTimeout(30, TimeUnit.SECONDS)
        .pingInterval(HEARTBEAT_MS, TimeUnit.MILLISECONDS)
        .build()

    /** Connect to the WebSocket endpoint */
    fun connect() {
        if (_connectionState.value == ConnectionState.CONNECTED ||
            _connectionState.value == ConnectionState.CONNECTING) return

        _connectionState.value = ConnectionState.CONNECTING
        Log.i(TAG, "Connecting to $wsUrl")

        val nonce = System.currentTimeMillis().toString()
        val signature = deviceIdentity.signNonce(nonce)
        val token = HeadyKeystore.getAuthToken() ?: ""

        val request = Request.Builder()
            .url(wsUrl)
            .header("Authorization", "Bearer $token")
            .header("X-Device-Id", deviceIdentity.deviceId)
            .header("X-Nonce", nonce)
            .header("X-Signature", signature)
            .header("X-Client", "HeadyBuddy-Android/1.0.0")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket connected")
                _connectionState.value = ConnectionState.CONNECTED
                reconnectAttempt = 0
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val message = json.decodeFromString<HeadyMessage>(text)
                    scope.launch { _messages.emit(message) }

                    // Handle challenge-response auth
                    if (message.type == "challenge") {
                        val challengeNonce = message.payload ?: return
                        val challengeSig = deviceIdentity.signNonce(challengeNonce)
                        val response = HeadyMessage(
                            type = "challenge_response",
                            payload = challengeSig
                        )
                        send(json.encodeToString(HeadyMessage.serializer(), response))
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to parse message: $text", e)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: ${t.message}", t)
                _connectionState.value = ConnectionState.DISCONNECTED
                stopHeartbeat()
                scheduleReconnect()
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closing: $code $reason")
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closed: $code $reason")
                _connectionState.value = ConnectionState.DISCONNECTED
                stopHeartbeat()
                if (code != 1000) {
                    scheduleReconnect()
                }
            }
        })
    }

    /** Send a text message over the WebSocket */
    fun send(text: String): Boolean {
        return webSocket?.send(text) ?: false
    }

    /** Send a typed HeadyMessage */
    fun send(message: HeadyMessage): Boolean {
        return send(json.encodeToString(HeadyMessage.serializer(), message))
    }

    /** Disconnect gracefully */
    fun disconnect() {
        stopHeartbeat()
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        _connectionState.value = ConnectionState.DISCONNECTED
        reconnectAttempt = 0
    }

    /** Phi-scaled heartbeat */
    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (true) {
                delay(HEARTBEAT_MS)
                val status = HeadyMessage.statusUpdate("alive", 1.0f)
                send(json.encodeToString(HeadyMessage.serializer(), status))
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    /** Fibonacci-backoff reconnection */
    private fun scheduleReconnect() {
        if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
            Log.w(TAG, "Max reconnect attempts ($MAX_RECONNECT_ATTEMPTS) reached")
            return
        }

        _connectionState.value = ConnectionState.RECONNECTING
        val delayMs = SacredGeometry.fibonacci(reconnectAttempt + 2) * 1000L
        reconnectAttempt++

        Log.i(TAG, "Reconnecting in ${delayMs}ms (attempt $reconnectAttempt)")
        scope.launch {
            delay(delayMs)
            connect()
        }
    }
}
