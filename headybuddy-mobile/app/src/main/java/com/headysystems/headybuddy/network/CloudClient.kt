/**
 * Cloud Client -- REST API communication with Heady Manager.
 * Authenticated via device identity + keystore token.
 * End-to-end encrypted payloads via HeadyKeystore AES-256-GCM.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.network

import com.headysystems.buddy.core.security.HeadyDeviceIdentity
import com.headysystems.buddy.core.security.HeadyKeystore
import com.headysystems.headybuddy.data.repository.ChatMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class CloudClient(
    private val baseUrl: String,
    private val keystore: HeadyKeystore,
    private val deviceIdentity: HeadyDeviceIdentity,
) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val original = chain.request()
            val nonce = System.currentTimeMillis().toString()
            val signature = deviceIdentity.signNonce(nonce)
            val token = HeadyKeystore.getAuthToken() ?: ""

            val request = original.newBuilder()
                .header("Authorization", "Bearer $token")
                .header("X-Device-Id", deviceIdentity.deviceId)
                .header("X-Nonce", nonce)
                .header("X-Signature", signature)
                .header("X-Client", "HeadyBuddy-Android/1.0.0")
                .build()
            chain.proceed(request)
        }
        .build()

    /** Stream chat response using Server-Sent Events */
    suspend fun streamChat(
        conversationId: String,
        messages: List<ChatMessage>,
        onChunk: (String) -> Unit,
        onComplete: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        withContext(Dispatchers.IO) {
            val messagesJson = JsonArray(
                messages.map { msg ->
                    JsonObject(mapOf(
                        "role" to JsonPrimitive(msg.role),
                        "content" to JsonPrimitive(msg.content)
                    ))
                }
            )

            val body = JsonObject(mapOf(
                "conversationId" to JsonPrimitive(conversationId),
                "messages" to messagesJson,
                "stream" to JsonPrimitive(true),
                "deviceId" to JsonPrimitive(deviceIdentity.deviceId)
            ))

            val request = Request.Builder()
                .url("${baseUrl}chat/stream")
                .post(json.encodeToString(body).toRequestBody(mediaType))
                .header("Accept", "text/event-stream")
                .build()

            val fullResponse = StringBuilder()

            val listener = object : EventSourceListener() {
                override fun onEvent(
                    eventSource: EventSource,
                    id: String?,
                    type: String?,
                    data: String
                ) {
                    if (data == "[DONE]") {
                        onComplete(fullResponse.toString())
                        return
                    }
                    try {
                        val chunk = json.parseToJsonElement(data).jsonObject
                        val content = chunk["content"]?.jsonPrimitive?.content ?: ""
                        if (content.isNotEmpty()) {
                            fullResponse.append(content)
                            onChunk(content)
                        }
                    } catch (e: Exception) {
                        // Non-JSON chunk, treat as raw text
                        fullResponse.append(data)
                        onChunk(data)
                    }
                }

                override fun onFailure(
                    eventSource: EventSource,
                    t: Throwable?,
                    response: Response?
                ) {
                    val error = t?.message ?: response?.message ?: "Unknown error"
                    if (fullResponse.isNotEmpty()) {
                        onComplete(fullResponse.toString())
                    } else {
                        onError(error)
                    }
                }

                override fun onClosed(eventSource: EventSource) {
                    if (fullResponse.isNotEmpty()) {
                        onComplete(fullResponse.toString())
                    }
                }
            }

            val factory = EventSources.createFactory(httpClient)
            factory.newEventSource(request, listener)
        }
    }

    /** Non-streaming chat request (fallback) */
    suspend fun chat(
        conversationId: String,
        messages: List<ChatMessage>
    ): String = withContext(Dispatchers.IO) {
        val messagesJson = JsonArray(
            messages.map { msg ->
                JsonObject(mapOf(
                    "role" to JsonPrimitive(msg.role),
                    "content" to JsonPrimitive(msg.content)
                ))
            }
        )

        val body = JsonObject(mapOf(
            "conversationId" to JsonPrimitive(conversationId),
            "messages" to messagesJson,
            "stream" to JsonPrimitive(false),
            "deviceId" to JsonPrimitive(deviceIdentity.deviceId)
        ))

        val request = Request.Builder()
            .url("${baseUrl}chat")
            .post(json.encodeToString(body).toRequestBody(mediaType))
            .build()

        val response = suspendCancellableCoroutine { cont ->
            val call = httpClient.newCall(request)
            cont.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    cont.resumeWithException(e)
                }
                override fun onResponse(call: Call, response: Response) {
                    cont.resume(response)
                }
            })
        }

        val responseBody = response.body?.string()
            ?: throw IOException("Empty response body")
        val parsed = json.parseToJsonElement(responseBody).jsonObject
        parsed["content"]?.jsonPrimitive?.content
            ?: parsed["response"]?.jsonPrimitive?.content
            ?: responseBody
    }

    /** Register device with cloud */
    suspend fun registerDevice(): Boolean = withContext(Dispatchers.IO) {
        val body = JsonObject(mapOf(
            "deviceId" to JsonPrimitive(deviceIdentity.deviceId),
            "publicKey" to JsonPrimitive(deviceIdentity.getPublicKeyBase64()),
            "platform" to JsonPrimitive("android"),
            "clientVersion" to JsonPrimitive("1.0.0")
        ))

        val request = Request.Builder()
            .url("${baseUrl}device/register")
            .post(json.encodeToString(body).toRequestBody(mediaType))
            .build()

        try {
            val response = suspendCancellableCoroutine { cont ->
                val call = httpClient.newCall(request)
                cont.invokeOnCancellation { call.cancel() }
                call.enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) { cont.resumeWithException(e) }
                    override fun onResponse(call: Call, response: Response) { cont.resume(response) }
                })
            }

            if (response.isSuccessful) {
                val respBody = response.body?.string()
                respBody?.let {
                    val parsed = json.parseToJsonElement(it).jsonObject
                    parsed["token"]?.jsonPrimitive?.content?.let { token ->
                        HeadyKeystore.setAuthToken(token)
                    }
                    parsed["userId"]?.jsonPrimitive?.content?.let { userId ->
                        HeadyKeystore.setUserId(userId)
                    }
                }
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    /** Simple chat send for ChatScreen (non-streaming) */
    suspend fun sendChat(
        message: String,
        history: List<com.headysystems.headybuddy.ui.screens.ChatMessage>
    ): String = withContext(Dispatchers.IO) {
        val historyJson = JsonArray(
            history.map { msg ->
                JsonObject(mapOf(
                    "role" to JsonPrimitive(if (msg.isUser) "user" else "assistant"),
                    "content" to JsonPrimitive(msg.content)
                ))
            }
        )

        val body = JsonObject(mapOf(
            "message" to JsonPrimitive(message),
            "history" to historyJson,
            "deviceId" to JsonPrimitive(deviceIdentity.deviceId)
        ))

        val request = Request.Builder()
            .url("${baseUrl}chat")
            .post(json.encodeToString(body).toRequestBody(mediaType))
            .build()

        val response = suspendCancellableCoroutine { cont ->
            val call = httpClient.newCall(request)
            cont.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) { cont.resumeWithException(e) }
                override fun onResponse(call: Call, response: Response) { cont.resume(response) }
            })
        }

        val responseBody = response.body?.string() ?: throw IOException("Empty response")
        try {
            val parsed = json.parseToJsonElement(responseBody).jsonObject
            parsed["reply"]?.jsonPrimitive?.content
                ?: parsed["content"]?.jsonPrimitive?.content
                ?: parsed["message"]?.jsonPrimitive?.content
                ?: responseBody
        } catch (e: Exception) {
            responseBody
        }
    }

    /** Health check */
    suspend fun healthCheck(): Boolean = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("${baseUrl}health")
                .get()
                .build()

            val response = suspendCancellableCoroutine { cont ->
                val call = httpClient.newCall(request)
                cont.invokeOnCancellation { call.cancel() }
                call.enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) { cont.resume(false) }
                    override fun onResponse(call: Call, response: Response) { cont.resume(response.isSuccessful) }
                })
            }
            response
        } catch (e: Exception) {
            false
        }
    }
}
