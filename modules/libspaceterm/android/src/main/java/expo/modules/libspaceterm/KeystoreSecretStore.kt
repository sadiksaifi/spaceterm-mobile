package expo.modules.libspaceterm

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.io.FileNotFoundException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import uniffi.spaceterm_mobile.SecretStore
import uniffi.spaceterm_mobile.SecretStoreException

internal class KeystoreSecretStore(context: Context) : SecretStore {
  private val directory = File(context.noBackupFilesDir, "pairing-secrets")

  @Synchronized
  override fun read(key: String): ByteArray? = secretOperation {
    val file = secretFile(key)
    val stored = try {
      AtomicFile(file).readFully()
    } catch (error: FileNotFoundException) {
      // AtomicFile can recover a previous write from its backup.
      if (file.exists() || File(directory, "$key.bak").exists()) throw error
      return@secretOperation null
    }
    check(stored.size >= IV_BYTES + TAG_BITS / Byte.SIZE_BITS)

    val secretKey = checkNotNull(keystore().getKey(KEY_ALIAS, null) as SecretKey?)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(TAG_BITS, stored, 0, IV_BYTES))
    cipher.updateAAD(key.toByteArray(Charsets.US_ASCII))
    cipher.doFinal(stored, IV_BYTES, stored.size - IV_BYTES)
  }

  @Synchronized
  override fun insert(key: String, secret: ByteArray) = secretOperation {
    val file = AtomicFile(secretFile(key))
    val secretKey = keystore().getKey(KEY_ALIAS, null) as SecretKey? ?: generateKey()
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, secretKey)
    cipher.updateAAD(key.toByteArray(Charsets.US_ASCII))

    // Android Keystore generates a fresh IV when the cipher is initialized for encryption.
    val iv = cipher.iv
    check(iv.size == IV_BYTES)
    val stored = iv + cipher.doFinal(secret)
    val output = file.startWrite()
    try {
      output.write(stored)
      output.fd.sync()
    } catch (error: Exception) {
      file.failWrite(output)
      throw error
    }
    file.finishWrite(output)
    // AtomicFile reports commit errors via logging. Check the bytes before confirming the insert.
    check(file.readFully().contentEquals(stored))
  }

  @Synchronized
  override fun remove(key: String) = secretOperation {
    val file = secretFile(key)
    AtomicFile(file).delete()
    check(!file.exists() && !File(directory, "$key.bak").exists() && !File(directory, "$key.new").exists())
  }

  @Synchronized
  override fun clear() = secretOperation {
    if (directory.exists()) {
      checkNotNull(directory.listFiles()).forEach { file ->
        check(file.delete() || !file.exists())
      }
    }
    keystore().deleteEntry(KEY_ALIAS)
  }

  private fun secretFile(key: String): File {
    require(SECRET_ID.matches(key))
    return File(directory, key)
  }

  private fun keystore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

  private fun generateKey(): SecretKey =
    KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).run {
      init(
        KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
          .setKeySize(256)
          .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
          .setUserAuthenticationRequired(false)
          .build()
      )
      generateKey()
    }

  private inline fun <T> secretOperation(operation: () -> T): T = try {
    operation()
  } catch (_: Exception) {
    throw SecretStoreException.Unavailable()
  }

  private companion object {
    const val KEYSTORE = "AndroidKeyStore"
    const val KEY_ALIAS = "spaceterm-pairing-secrets"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
    const val IV_BYTES = 12
    const val TAG_BITS = 128
    val SECRET_ID = Regex("[0-9a-fA-F]{64}")
  }
}
