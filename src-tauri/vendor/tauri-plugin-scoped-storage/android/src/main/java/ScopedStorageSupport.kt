package com.danielerolli.tauri.scopedstorage

import android.app.Activity
import android.net.Uri
import android.webkit.MimeTypeMap
import app.tauri.plugin.Invoke

internal const val NATIVE_ERROR_PREFIX = "SCOPED_STORAGE_ERROR"

internal object ErrorCodes {
    const val UNSUPPORTED = "UNSUPPORTED"
    const val INVALID_PATH = "INVALID_PATH"
    const val FOLDER_NOT_FOUND = "FOLDER_NOT_FOUND"
    const val NOT_FOUND = "NOT_FOUND"
    const val ALREADY_EXISTS = "ALREADY_EXISTS"
    const val PERMISSION_DENIED = "PERMISSION_DENIED"
    const val CANCELLED = "CANCELLED"
    const val IO_ERROR = "IO_ERROR"
    const val NATIVE_ERROR = "NATIVE_ERROR"
    const val INVALID_ARGUMENT = "INVALID_ARGUMENT"
}

internal class ScopedStorageException(
    val code: String,
    override val message: String,
    cause: Throwable? = null,
) : Exception(message, cause)

internal fun fail(code: String, message: String): Nothing =
    throw ScopedStorageException(code, message)

internal fun Invoke.rejectScoped(error: Throwable) {
    val scoped = error.toScopedStorageException()
    reject("$NATIVE_ERROR_PREFIX:${scoped.code}:${scoped.message}")
}

private fun Throwable.toScopedStorageException(): ScopedStorageException =
    when (this) {
        is ScopedStorageException -> this
        is SecurityException -> ScopedStorageException(ErrorCodes.PERMISSION_DENIED, message ?: "permission denied", this)
        is IllegalArgumentException -> ScopedStorageException(ErrorCodes.INVALID_ARGUMENT, message ?: "invalid argument", this)
        else -> ScopedStorageException(ErrorCodes.NATIVE_ERROR, message ?: "native command failed", this)
    }

internal object ScopedStoragePaths {
    fun split(path: String): List<String> {
        val normalized = path.trim().replace('\\', '/')
        if (normalized.isEmpty()) {
            return emptyList()
        }

        if (normalized.startsWith('/') || normalized.startsWith('~') || normalized.contains('\u0000')) {
            fail(ErrorCodes.INVALID_PATH, "Path must be relative")
        }

        val out = mutableListOf<String>()
        normalized.split('/').forEachIndexed { index, segment ->
            when {
                segment.isEmpty() || segment == "." -> Unit
                segment == ".." -> fail(ErrorCodes.INVALID_PATH, "Parent segments are not allowed")
                index == 0 && segment.contains(':') -> fail(ErrorCodes.INVALID_PATH, "Absolute and URI-style paths are not allowed")
                else -> out += segment
            }
        }
        return out
    }

    fun join(left: String, right: String): String =
        listOf(left.trim('/'), right.trim('/')).filter { it.isNotEmpty() }.joinToString("/")

    fun parent(path: String): String = split(path).dropLast(1).joinToString("/")

    fun name(path: String): String {
        val parts = split(path)
        if (parts.isEmpty()) {
            fail(ErrorCodes.INVALID_PATH, "Path must not be empty")
        }
        return parts.last()
    }
}

internal object ScopedStorageMimeTypes {
    fun forPath(path: String): String {
        val extension = path.substringAfterLast('.', "").lowercase()
        return if (extension.isNotEmpty()) {
            MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
                ?: fallback(extension)
        } else {
            "application/octet-stream"
        }
    }

    private fun fallback(extension: String): String =
        when (extension) {
            "txt", "md", "csv", "log" -> "text/plain"
            "json" -> "application/json"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "pdf" -> "application/pdf"
            else -> "application/octet-stream"
        }
}

internal data class StoredFolder(
    val id: String,
    val name: String?,
    val uri: String?,
)

internal class FolderStore(private val activity: Activity) {
    private val prefs = activity.getSharedPreferences("scoped_storage", Activity.MODE_PRIVATE)

    fun save(uri: Uri, name: String?): StoredFolder {
        val id = java.util.UUID.randomUUID().toString()
        prefs.edit()
            .putString("folder:$id:uri", uri.toString())
            .putString("folder:$id:name", name)
            .apply()
        return StoredFolder(id = id, name = name, uri = uri.toString())
    }

    fun getUri(id: String): Uri {
        val value = prefs.getString("folder:$id:uri", null)
            ?: fail(ErrorCodes.FOLDER_NOT_FOUND, "Folder not found: $id")
        return Uri.parse(value)
    }

    fun getEntry(id: String): StoredFolder {
        val uri = prefs.getString("folder:$id:uri", null)
            ?: fail(ErrorCodes.FOLDER_NOT_FOUND, "Folder not found: $id")
        return StoredFolder(
            id = id,
            name = prefs.getString("folder:$id:name", null),
            uri = uri,
        )
    }

    fun list(): List<StoredFolder> =
        prefs.all.keys
            .asSequence()
            .filter { it.startsWith("folder:") && it.endsWith(":uri") }
            .map { key -> key.removePrefix("folder:").removeSuffix(":uri") }
            .distinct()
            .sorted()
            .map { getEntry(it) }
            .toList()

    fun remove(id: String) {
        prefs.edit()
            .remove("folder:$id:uri")
            .remove("folder:$id:name")
            .apply()
    }
}
