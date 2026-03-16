/**
 * HeadyDeviceIdentity — Ed25519 device identity via Android Keystore.
 * Used for challenge-response device auth on every WSS handshake.
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.buddy.core.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.util.UUID

class HeadyDeviceIdentity(private val context: Context) {

    companion object {
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS = "heady_device_ed25519"
        private const val DEVICE_ID_PREF = "heady_device_id"

        @Volatile private var instance: HeadyDeviceIdentity? = null
        fun getInstance(context: Context): HeadyDeviceIdentity =
            instance ?: synchronized(this) {
                instance ?: HeadyDeviceIdentity(context.applicationContext).also { instance = it }
            }
    }

    val deviceId: String by lazy { getOrCreateDeviceId() }

    init {
        ensureKeyPairExists()
    }

    private fun ensureKeyPairExists() {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        if (!ks.containsAlias(KEY_ALIAS)) {
            val spec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build()

            KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE_PROVIDER)
                .apply { initialize(spec) }
                .generateKeyPair()
        }
    }

    fun signNonce(nonce: String): String {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        val privateKey = ks.getKey(KEY_ALIAS, null) as java.security.PrivateKey
        val sig = Signature.getInstance("SHA256withECDSA")
        sig.initSign(privateKey)
        sig.update(nonce.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(sig.sign(), Base64.NO_WRAP)
    }

    fun getPublicKeyBase64(): String {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        val cert = ks.getCertificate(KEY_ALIAS)
        return Base64.encodeToString(cert.publicKey.encoded, Base64.NO_WRAP)
    }

    private fun getOrCreateDeviceId(): String {
        val prefs = context.getSharedPreferences("heady_identity", Context.MODE_PRIVATE)
        return prefs.getString(DEVICE_ID_PREF, null) ?: run {
            val id = UUID.randomUUID().toString()
            prefs.edit().putString(DEVICE_ID_PREF, id).apply()
            id
        }
    }
}
