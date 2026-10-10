package com.danielerolli.tauri.scopedstorage

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.ParcelFileDescriptor
import androidx.activity.result.ActivityResult
import androidx.documentfile.provider.DocumentFile
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.ByteBuffer
import kotlin.math.min


@InvokeArg
class FolderIdArgs {
    lateinit var folderId: String
}

@InvokeArg
class ReadFileArgs {
    lateinit var folderId: String
    lateinit var path: String
}

@InvokeArg
class WriteFileArgs {
    lateinit var folderId: String
    lateinit var path: String
    lateinit var data: ByteArray
    var mimeType: String? = null
    var recursive: Boolean? = null
}

@InvokeArg
class WriteTextFileArgs {
    lateinit var folderId: String
    lateinit var path: String
    lateinit var contents: String
    var recursive: Boolean? = null
}

@InvokeArg
class AppendFileArgs {
    lateinit var folderId: String
    lateinit var path: String
    lateinit var data: ByteArray
    var mimeType: String? = null
    var create: Boolean? = null
    var recursive: Boolean? = null
}

@InvokeArg
class ReadDirArgs {
    lateinit var folderId: String
    var path: String? = null
}

@InvokeArg
class StatArgs {
    lateinit var folderId: String
    lateinit var path: String
}

@InvokeArg
class ExistsArgs {
    lateinit var folderId: String
    lateinit var path: String
}

@InvokeArg
class MkdirArgs {
    lateinit var folderId: String
    lateinit var path: String
    var recursive: Boolean? = null
}

@InvokeArg
class RemoveFileArgs {
    lateinit var folderId: String
    lateinit var path: String
}

@InvokeArg
class RemoveDirArgs {
    lateinit var folderId: String
    lateinit var path: String
    var recursive: Boolean? = null
}

@InvokeArg
class CopyArgs {
    lateinit var fromFolderId: String
    lateinit var fromPath: String
    lateinit var toFolderId: String
    lateinit var toPath: String
}

@InvokeArg
class MoveArgs {
    lateinit var fromFolderId: String
    lateinit var fromPath: String
    lateinit var toFolderId: String
    lateinit var toPath: String
}

@InvokeArg
class RenameArgs {
    lateinit var folderId: String
    lateinit var fromPath: String
    lateinit var toPath: String
}

@InvokeArg
class TruncateArgs {
    lateinit var folderId: String
    lateinit var path: String
    var len: Long = 0
}

@TauriPlugin
class ScopedStoragePlugin(private val activity: Activity) : Plugin(activity) {
    private val folderStore = FolderStore(activity)
    // Instance-scoped coroutine scope; cancelled when the plugin is torn down.
    private val ioScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onDestroy() {
        super.onDestroy()
        ioScope.cancel()
    }

    @Command
    fun pickFolder(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
            )
        }
        startActivityForResult(invoke, intent, "onFolderPicked")
    }

    @SuppressLint("WrongConstant")
    @ActivityCallback
    fun onFolderPicked(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            invoke.reject("$NATIVE_ERROR_PREFIX:${ErrorCodes.CANCELLED}:User cancelled")
            return
        }

        val uri = result.data?.data ?: run {
            invoke.reject("$NATIVE_ERROR_PREFIX:${ErrorCodes.NATIVE_ERROR}:No folder URI returned")
            return
        }

        try {
            activity.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
        } catch (_: SecurityException) {
        }

        val doc = DocumentFile.fromTreeUri(activity, uri)
            ?: run {
                invoke.reject("$NATIVE_ERROR_PREFIX:${ErrorCodes.NATIVE_ERROR}:Unable to access selected folder")
                return
            }

        val stored = folderStore.save(uri, doc.name ?: uri.lastPathSegment ?: "Folder")
        invoke.resolve(JSObject().apply { put("folder", folderObject(stored)) })
    }

    @Command
    fun forgetFolder(invoke: Invoke) {
        val args = invoke.parseArgs(FolderIdArgs::class.java)
        folderStore.remove(args.folderId)
        invoke.resolve()
    }

    @Command
    fun listFolders(invoke: Invoke) {
        val folders = JSArray()
        folderStore.list().forEach { folders.put(folderObject(it)) }
        invoke.resolve(JSObject().apply { put("folders", folders) })
    }

    @Command
    fun getFolderInfo(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(FolderIdArgs::class.java)
            invoke.resolve(folderObject(folderStore.getEntry(args.folderId)))
        } catch (error: Throwable) {
            invoke.rejectScoped(error)
        }
    }

    @Command
    fun readDir(invoke: Invoke) {
        val args = invoke.parseArgs(ReadDirArgs::class.java)
        ioScope.launch {
            try {
                val basePath = args.path.orEmpty()
                val dir = if (basePath.isBlank()) requireBase(args.folderId) else requireEntry(args.folderId, basePath)
                if (!dir.isDirectory) {
                    fail(ErrorCodes.INVALID_ARGUMENT, "Path is not a directory")
                }

                val entries = JSArray()
                dir.listFiles().forEach { entries.put(statObject(basePath, it)) }
                invoke.resolve(JSObject().apply { put("entries", entries) })
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun stat(invoke: Invoke) {
        val args = invoke.parseArgs(StatArgs::class.java)
        ioScope.launch {
            try {
                val entry = requireEntry(args.folderId, args.path)
                invoke.resolve(statObject(ScopedStoragePaths.parent(args.path), entry))
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun exists(invoke: Invoke) {
        val args = invoke.parseArgs(ExistsArgs::class.java)
        ioScope.launch {
            try {
                val entry = resolveEntry(args.folderId, args.path)
                invoke.resolve(JSObject().apply { put("exists", entry != null) })
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun readFile(invoke: Invoke) {
        val args = invoke.parseArgs(ReadFileArgs::class.java)
        ioScope.launch {
            try {
                val file = requireFile(args.folderId, args.path)
                val bytes = activity.contentResolver.openInputStream(file.uri)?.use { it.readAllBytesCompat() }
                    ?: fail(ErrorCodes.IO_ERROR, "Failed to open input stream")
		            val unsigned = bytes.map { it.toInt() and 0xFF }
                invoke.resolve(JSObject().apply { put("data", JSArray(unsigned.toList())) })
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun readTextFile(invoke: Invoke) {
        val args = invoke.parseArgs(ReadFileArgs::class.java)
        ioScope.launch {
            try {
                val file = requireFile(args.folderId, args.path)
                val bytes = activity.contentResolver.openInputStream(file.uri)?.use { it.readAllBytesCompat() }
                    ?: fail(ErrorCodes.IO_ERROR, "Failed to open input stream")
                invoke.resolve(JSObject().apply { put("contents", bytes.toString(Charsets.UTF_8)) })
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun readTextFileLines(invoke: Invoke) {
        val args = invoke.parseArgs(ReadFileArgs::class.java)
        ioScope.launch {
            try {
                val file = requireFile(args.folderId, args.path)
                val bytes = activity.contentResolver.openInputStream(file.uri)?.use { it.readAllBytesCompat() }
                    ?: fail(ErrorCodes.IO_ERROR, "Failed to open input stream")
                val lines = JSArray()
                bytes.toString(Charsets.UTF_8).lines().forEach { lines.put(it) }
                invoke.resolve(JSObject().apply { put("lines", lines) })
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun writeFile(invoke: Invoke) {
        val args = invoke.parseArgs(WriteFileArgs::class.java)
        ioScope.launch {
            try {
                val file = ensureFile(
                    folderId = args.folderId,
                    relPath = args.path,
                    mimeType = args.mimeType ?: ScopedStorageMimeTypes.forPath(args.path),
                    recursive = args.recursive ?: false
                )
                writeBytes(file, args.data, append = false)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun writeTextFile(invoke: Invoke) {
        val args = invoke.parseArgs(WriteTextFileArgs::class.java)
        ioScope.launch {
            try {
                val file = ensureFile(
                    folderId = args.folderId,
                    relPath = args.path,
                    mimeType = ScopedStorageMimeTypes.forPath(args.path),
                    recursive = args.recursive ?: false
                )
                writeBytes(file, args.contents.toByteArray(Charsets.UTF_8), append = false)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun appendFile(invoke: Invoke) {
        val args = invoke.parseArgs(AppendFileArgs::class.java)
        ioScope.launch {
            try {
                val file = resolveEntry(args.folderId, args.path)
                val target = when {
                    file == null && args.create != false -> ensureFile(
                        folderId = args.folderId,
                        relPath = args.path,
                        mimeType = args.mimeType ?: ScopedStorageMimeTypes.forPath(args.path),
                        recursive = args.recursive ?: false
                    )
                    file == null -> fail(ErrorCodes.NOT_FOUND, "File not found")
                    !file.isFile -> fail(ErrorCodes.INVALID_ARGUMENT, "Target is not a file")
                    else -> file
                }
                writeBytes(target, args.data, append = true)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun mkdir(invoke: Invoke) {
        val args = invoke.parseArgs(MkdirArgs::class.java)
        ioScope.launch {
            try {
                ensureDirectory(args.folderId, args.path, args.recursive ?: false)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun removeFile(invoke: Invoke) {
        val args = invoke.parseArgs(RemoveFileArgs::class.java)
        ioScope.launch {
            try {
                val file = requireFile(args.folderId, args.path)
                if (!file.delete()) {
                    fail(ErrorCodes.IO_ERROR, "Delete failed")
                }
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun removeDir(invoke: Invoke) {
        val args = invoke.parseArgs(RemoveDirArgs::class.java)
        ioScope.launch {
            try {
                val dir = requireDirectory(args.folderId, args.path)
                if (!(args.recursive ?: false) && dir.listFiles().isNotEmpty()) {
                    fail(ErrorCodes.INVALID_ARGUMENT, "Directory not empty")
                }
                deleteRecursively(dir)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun copy(invoke: Invoke) {
        val args = invoke.parseArgs(CopyArgs::class.java)
        ioScope.launch {
            try {
                copyEntry(args.fromFolderId, args.fromPath, args.toFolderId, args.toPath)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun move(invoke: Invoke) {
        val args = invoke.parseArgs(MoveArgs::class.java)
        ioScope.launch {
            try {
                moveEntry(args.fromFolderId, args.fromPath, args.toFolderId, args.toPath)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun rename(invoke: Invoke) {
        val args = invoke.parseArgs(RenameArgs::class.java)
        ioScope.launch {
            try {
                renameEntry(args.folderId, args.fromPath, args.toPath)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    @Command
    fun truncate(invoke: Invoke) {
        val args = invoke.parseArgs(TruncateArgs::class.java)
        // Validate before dispatching to avoid allocating a coroutine for bad input.
        if (args.len < 0) {
            invoke.rejectScoped(ScopedStorageException(ErrorCodes.INVALID_ARGUMENT, "Truncate length must be non-negative"))
            return
        }
        ioScope.launch {
            try {
                val file = requireFile(args.folderId, args.path)
                truncateFile(file, args.len)
                invoke.resolve()
            } catch (error: Throwable) {
                invoke.rejectScoped(error)
            }
        }
    }

    private fun folderObject(folder: StoredFolder): JSObject =
        JSObject().apply {
            put("id", folder.id)
            put("name", folder.name)
            put("uri", folder.uri)
        }

    private fun requireBase(folderId: String): DocumentFile {
        val uri = folderStore.getUri(folderId)
        return DocumentFile.fromTreeUri(activity, uri)
            ?: fail(ErrorCodes.PERMISSION_DENIED, "Unable to access persisted folder")
    }

    private fun resolveEntry(folderId: String, relPath: String): DocumentFile? {
        var current = requireBase(folderId)
        val parts = ScopedStoragePaths.split(relPath)
        if (parts.isEmpty()) {
            return current
        }
        for (part in parts) {
            current = current.findFile(part) ?: return null
        }
        return current
    }

    private fun requireEntry(folderId: String, relPath: String): DocumentFile =
        resolveEntry(folderId, relPath) ?: fail(ErrorCodes.NOT_FOUND, "Path not found: $relPath")

    private fun requireFile(folderId: String, relPath: String): DocumentFile {
        val file = requireEntry(folderId, relPath)
        if (!file.isFile) {
            fail(ErrorCodes.INVALID_ARGUMENT, "Path is not a file")
        }
        return file
    }

    private fun requireDirectory(folderId: String, relPath: String): DocumentFile {
        val dir = requireEntry(folderId, relPath)
        if (!dir.isDirectory) {
            fail(ErrorCodes.INVALID_ARGUMENT, "Path is not a directory")
        }
        return dir
    }

    private fun ensureDirectory(folderId: String, relPath: String, recursive: Boolean): DocumentFile {
        var current = requireBase(folderId)
        val parts = ScopedStoragePaths.split(relPath)
        if (parts.isEmpty()) {
            fail(ErrorCodes.INVALID_PATH, "Path must not be empty")
        }

        parts.forEachIndexed { index, part ->
            val existing = current.findFile(part)
            if (existing != null) {
                if (!existing.isDirectory) {
                    fail(ErrorCodes.INVALID_ARGUMENT, "Path segment is not a directory: $part")
                }
                if (!recursive && index == parts.lastIndex) {
                    fail(ErrorCodes.ALREADY_EXISTS, "Directory already exists: $relPath")
                }
                current = existing
            } else {
                if (!recursive && index != parts.lastIndex) {
                    fail(ErrorCodes.NOT_FOUND, "Parent directory missing for: $relPath")
                }
                current = current.createDirectory(part)
                    ?: fail(ErrorCodes.IO_ERROR, "Failed to create directory: $part")
            }
        }

        return current
    }

    private fun ensureFile(folderId: String, relPath: String, mimeType: String, recursive: Boolean): DocumentFile {
        val parent = ensureParentDirectory(folderId, relPath, recursive)
        val filename = ScopedStoragePaths.name(relPath)
        val existing = parent.findFile(filename)
        if (existing != null) {
            if (!existing.isFile) {
                fail(ErrorCodes.INVALID_ARGUMENT, "Target exists and is not a file")
            }
            return existing
        }

        return parent.createFile(mimeType, filename)
            ?: fail(ErrorCodes.IO_ERROR, "Failed to create file: $filename")
    }

    private fun ensureParentDirectory(folderId: String, relPath: String, recursive: Boolean): DocumentFile {
        val parentPath = ScopedStoragePaths.parent(relPath)
        return if (parentPath.isEmpty()) {
            requireBase(folderId)
        } else {
            ensureDirectory(folderId, parentPath, recursive)
        }
    }

    private fun requireDestinationAbsent(folderId: String, relPath: String) {
        if (resolveEntry(folderId, relPath) != null) {
            fail(ErrorCodes.ALREADY_EXISTS, "Destination already exists: $relPath")
        }
    }

    private fun copyEntry(fromFolderId: String, fromPath: String, toFolderId: String, toPath: String) {
        val source = requireEntry(fromFolderId, fromPath)
        requireDestinationAbsent(toFolderId, toPath)

        if (source.isDirectory) {
            val destination = ensureDirectory(toFolderId, toPath, recursive = true)
            source.listFiles().forEach { child ->
                val childName = child.name ?: return@forEach
                copyEntry(
                    fromFolderId,
                    ScopedStoragePaths.join(fromPath, childName),
                    toFolderId,
                    ScopedStoragePaths.join(toPath, childName),
                )
            }
            if (!destination.isDirectory) {
                fail(ErrorCodes.IO_ERROR, "Failed to create destination directory")
            }
            return
        }

        val destination = ensureFile(
            folderId = toFolderId,
            relPath = toPath,
            mimeType = source.type ?: ScopedStorageMimeTypes.forPath(toPath),
            recursive = true,
        )
        activity.contentResolver.openInputStream(source.uri).use { input ->
            activity.contentResolver.openOutputStream(destination.uri, "w").use { output ->
                if (input == null || output == null) {
                    fail(ErrorCodes.IO_ERROR, "Failed to open file streams")
                }
                input.copyTo(output)
            }
        }
    }

    private fun moveEntry(fromFolderId: String, fromPath: String, toFolderId: String, toPath: String) {
        if (fromFolderId == toFolderId && ScopedStoragePaths.parent(fromPath) == ScopedStoragePaths.parent(toPath)) {
            val source = requireEntry(fromFolderId, fromPath)
            requireDestinationAbsent(toFolderId, toPath)
            val newName = ScopedStoragePaths.name(toPath)
            if (!source.renameTo(newName)) {
                fail(ErrorCodes.IO_ERROR, "Rename failed")
            }
            return
        }

        copyEntry(fromFolderId, fromPath, toFolderId, toPath)
        deleteRecursively(requireEntry(fromFolderId, fromPath))
    }

    private fun renameEntry(folderId: String, fromPath: String, toPath: String) {
        moveEntry(folderId, fromPath, folderId, toPath)
    }

    private fun truncateFile(file: DocumentFile, length: Long) {
        activity.contentResolver.openFileDescriptor(file.uri, "rw")?.use { descriptor ->
            resizeFileDescriptor(descriptor, length)
        } ?: fail(ErrorCodes.IO_ERROR, "Failed to open file descriptor")
    }

    private fun resizeFileDescriptor(descriptor: ParcelFileDescriptor, length: Long) {
        FileOutputStream(descriptor.fileDescriptor).channel.use { channel ->
            val currentSize = channel.size()
            if (length <= currentSize) {
                channel.truncate(length)
                return
            }

            channel.position(currentSize)
            var remaining = length - currentSize
            val chunk = ByteArray(min(8192L, remaining).toInt())
            while (remaining > 0) {
                val bytes = min(chunk.size.toLong(), remaining).toInt()
                channel.write(ByteBuffer.wrap(chunk, 0, bytes))
                remaining -= bytes
            }
        }
    }

    private fun writeBytes(file: DocumentFile, data: ByteArray, append: Boolean) {
        val mode = if (append) "wa" else "w"
        activity.contentResolver.openOutputStream(file.uri, mode)?.use { stream ->
            stream.write(data)
        } ?: fail(ErrorCodes.IO_ERROR, "Failed to open output stream")
    }

    private fun deleteRecursively(file: DocumentFile) {
        if (file.isDirectory) {
            file.listFiles().forEach { deleteRecursively(it) }
        }
        if (!file.delete()) {
            fail(ErrorCodes.IO_ERROR, "Delete failed: ${file.name ?: "entry"}")
        }
    }

    private fun statObject(parentPath: String, file: DocumentFile): JSObject =
        JSObject().apply {
            val name = file.name ?: ""
            put("name", name)
            put("path", ScopedStoragePaths.join(parentPath, name))
            put("isFile", file.isFile)
            put("isDir", file.isDirectory)
            put("size", if (file.isFile) file.length() else null)
            put("mimeType", file.type)
            put("lastModified", file.lastModified().takeIf { it > 0 }?.div(1000))
        }

    private fun InputStream.readAllBytesCompat(): ByteArray {
        val buffer = ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        var read: Int
        while (read(chunk).also { read = it } != -1) {
            buffer.write(chunk, 0, read)
        }
        return buffer.toByteArray()
    }
}
