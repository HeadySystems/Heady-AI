/**
 * HeadyKeystore — Secure token and credential storage via Android Keystore.
 * Never uses SharedPreferences for secrets.
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.buddy.core.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class HeadyKeystore(private val context: Context) {

    companion object {
        private const val KEYSTORE = "AndroidKeyStore"
        private const val AES_ALIAS = "heady_aes_master"
        private const val PREFS_NAME = "heady_vault"
        private const val AES_GCM = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH = 128

        @Volatile private var instance: HeadyKeystore? = null
        fun getInstance(context: Context): HeadyKeystore =
            instance ?: synchronized(this) {
                instance ?: HeadyKeystore(context.applicationContext).also { instance = it }
            }

        // Static convenience accessors for use in bridge/memory clients
        private var staticInstance: HeadyKeystore? = null
        fun init(context: Context) { staticInstance = getInstance(context) }
        fun getAuthToken(): String? = staticInstance?.decrypt("auth_token")
        fun setAuthToken(token: String) { staticInstance?.encrypt("auth_token", token) }
        fun getUserId(): String? = staticInstance?.decrypt("user_id")
        fun setUserId(id: String) { staticInstance?.encrypt("user_id", id) }
    }

    private val prefs by lazy { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

    init {
        ensureAesKeyExists()
    }

    private fun ensureAesKeyExists() {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        if (!ks.containsAlias(AES_ALIAS)) {
            val spec = KeyGenParameterSpec.Builder(
                AES_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()

            KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
                .apply { init(spec) }
                .generateKey()
        }
    }

    private fun getAesKey(): SecretKey {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        return (ks.getEntry(AES_ALIAS, null) as KeyStore.SecretKeyEntry).secretKey
    }

    fun encrypt(key: String, plaintext: String) {
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, getAesKey())
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val combined = iv + ciphertext
        prefs.edit().putString(key, Base64.encodeToString(combined, Base64.NO_WRAP)).apply()
    }

    fun decrypt(key: String): String? {
        val encoded = prefs.getString(key, null) ?: return null
        val combined = Base64.decode(encoded, Base64.NO_WRAP)
        val iv = combined.copyOfRange(0, 12)
        val ciphertext = combined.copyOfRange(12, combined.size)
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.DECRYPT_MODE, getAesKey(), GCMParameterSpec(GCM_TAG_LENGTH, iv))
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }

    fun clear(key: String) {
        prefs.edit().remove(key).apply()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }
}
