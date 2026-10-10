# tauri-plugin-scoped-storage

A Tauri 2 plugin for user-approved folder access on Android and iOS.

Unlike `@tauri-apps/plugin-fs`, which works with app-owned paths and base directories, this plugin lets users explicitly pick a folder at runtime. The plugin stores a persistent handle to that folder so your app can read and write inside it across sessions, without ever asking for broad storage permissions.

- **Android** uses the Storage Access Framework with persisted tree URI permissions.
- **iOS** uses `UIDocumentPickerViewController` with persisted security-scoped bookmarks.
- **Desktop** targets compile cleanly and return stable `UNSUPPORTED` errors.


## Supported Platforms

| Platform | Support |
|----------|---------|
| Android  | ✅ Full |
| iOS      | ✅ Full |
| macOS    | ⛔ Returns `UNSUPPORTED` |
| Windows  | ⛔ Returns `UNSUPPORTED` |
| Linux    | ⛔ Returns `UNSUPPORTED` |

Minimum requirements: Android API 21+, iOS 14+, Rust 1.77.2+.

## Installation

Add the Rust crate to your Tauri app's `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-scoped-storage = "0.1"
```

Add the JavaScript package:

```sh
pnpm add tauri-plugin-scoped-storage-api
# or
npm install tauri-plugin-scoped-storage-api
```

Register the plugin in `src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_scoped_storage::init())
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
```

Grant the plugin permission in your app's capability file (e.g. `src-tauri/capabilities/default.json`):

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "scoped-storage:default"
  ]
}
```

## Quick Start

```ts
import {
  pickFolder,
  writeTextFile,
  readTextFile,
  appendTextFile,
  readDir,
  isScopedStorageError,
} from "tauri-plugin-scoped-storage-api";

// Ask the user to pick a folder. The handle persists across restarts.
const folder = await pickFolder();

// Write a text file inside the picked folder.
await writeTextFile(folder.id, "notes/hello.txt", "Hello from scoped storage\n", {
  recursive: true, // create intermediate directories if needed
});

// Append to it.
await appendTextFile(folder.id, "notes/hello.txt", "More text\n", {
  create: true,
  recursive: true,
});

// Read it back.
const text = await readTextFile(folder.id, "notes/hello.txt");

// List entries in a subdirectory.
const entries = await readDir(folder.id, "notes");

// Handle errors by error code.
try {
  await readTextFile(folder.id, "notes/missing.txt");
} catch (e) {
  if (isScopedStorageError(e) && e.code === "NOT_FOUND") {
    console.log("file does not exist yet");
  }
}
```


## API Reference

All functions are `async` and throw a [`ScopedStorageError`](#error-handling) on failure.

### Folder Management

#### `pickFolder(): Promise<FolderHandle>`

Opens the platform folder picker. Returns a `FolderHandle` whose `id` is used in all subsequent calls. The handle is persisted automatically and survives app restarts.

```ts
const folder = await pickFolder();
console.log(folder.id);   // opaque string ID
console.log(folder.name); // display name, e.g. "Documents"
console.log(folder.uri);  // platform URI, useful for debugging
```

#### `listFolders(): Promise<FolderHandle[]>`

Returns all previously persisted folder handles. Call this on startup to restore handles from prior sessions.

```ts
const folders = await listFolders();
```

#### `getFolderInfo(folderId: string): Promise<FolderHandle>`

Returns refreshed metadata for a specific folder handle.

```ts
const info = await getFolderInfo(folder.id);
```

#### `forgetFolder(folderId: string): Promise<void>`

Removes a persisted folder handle. The app will no longer have access to that folder.

```ts
await forgetFolder(folder.id);
```

### Reading Files

#### `readTextFile(folderId, path): Promise<string>`

Reads the entire contents of a file as a UTF-8 string.

```ts
const text = await readTextFile(folder.id, "notes/hello.txt");
```

#### `readTextFileLines(folderId, path): Promise<string[]>`

Reads a text file and splits it into lines.

```ts
const lines = await readTextFileLines(folder.id, "log.txt");
```

#### `readFile(folderId, path): Promise<Uint8Array>`

Reads a binary file as raw bytes.

```ts
const bytes = await readFile(folder.id, "data.bin");
```

### Writing Files

#### `writeTextFile(folderId, path, contents, options?): Promise<void>`

Writes a UTF-8 string to a file, replacing any existing content.

```ts
await writeTextFile(folder.id, "notes/hello.txt", "Hello!\n", { recursive: true });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `recursive` | `boolean` | `false` | Create intermediate directories automatically |

#### `writeFile(folderId, path, data, options?): Promise<void>`

Writes raw bytes to a file, replacing any existing content.

```ts
const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
await writeFile(folder.id, "image.png", bytes, { mimeType: "image/png", recursive: true });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mimeType` | `string` | inferred from extension | MIME type hint used by Android's `ContentResolver` |
| `recursive` | `boolean` | `false` | Create intermediate directories automatically |

#### `appendTextFile(folderId, path, contents, options?): Promise<void>`

Appends a UTF-8 string to a file. Creates the file if it does not exist and `create` is `true`.

```ts
await appendTextFile(folder.id, "log.txt", "entry\n", { create: true, recursive: true });
```

#### `appendFile(folderId, path, data, options?): Promise<void>`

Appends raw bytes to a file.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mimeType` | `string` | inferred from extension | MIME type hint used by Android |
| `create` | `boolean` | `true` | Create the file if it does not exist |
| `recursive` | `boolean` | `false` | Create intermediate directories automatically |

---

### Directory Operations

#### `readDir(folderId, path?): Promise<DirEntry[]>`

Lists the immediate children of a directory. Omit `path` to list the root of the picked folder.

```ts
const root   = await readDir(folder.id);
const nested = await readDir(folder.id, "docs/2024");
```

Each `DirEntry`:

```ts
interface DirEntry {
  name: string;
  path: string;                  // relative path from the folder root
  isFile: boolean;
  isDir: boolean;
  size?: number | null;          // bytes; files only
  mimeType?: string | null;
  lastModified?: number | null;  // Unix seconds
}
```

#### `mkdir(folderId, path, recursive?): Promise<void>`

Creates a directory. Pass `recursive: true` to create intermediate parents.

```ts
await mkdir(folder.id, "photos/2024/vacation", true);
```

#### `removeDir(folderId, path, recursive?): Promise<void>`

Removes a directory. Pass `recursive: true` to also remove its contents.

```ts
await removeDir(folder.id, "tmp", true);
```

---

### File Metadata

#### `stat(folderId, path): Promise<FileStat>`

Returns metadata for a file or directory. `FileStat` has the same shape as `DirEntry`.

```ts
const info = await stat(folder.id, "notes/hello.txt");
console.log(info.size); // bytes
```

#### `exists(folderId, path): Promise<boolean>`

Returns `true` if the path exists, regardless of whether it is a file or directory.

```ts
if (await exists(folder.id, "config.json")) {
  // safe to read
}
```

---

### Moving, Copying, and Renaming

#### `copy(fromFolderId, fromPath, toFolderId, toPath): Promise<void>`

Copies a file or directory tree. The destination must not already exist. Source and destination may belong to different folder handles.

```ts
await copy(folder.id, "report.pdf", folder.id, "archive/report-2024.pdf");
```

#### `move(fromFolderId, fromPath, toFolderId, toPath): Promise<void>`

Moves a file or directory. Implemented as copy then delete. Source and destination may belong to different folder handles.

```ts
await move(folder.id, "drafts/post.md", folder.id, "published/post.md");
```

Alias: `mv`

#### `rename(folderId, fromPath, toPath): Promise<void>`

Renames a file or directory within the same folder handle. Source and destination must differ.

```ts
await rename(folder.id, "notes/draft.txt", "notes/final.txt");
```

#### `removeFile(folderId, path): Promise<void>`

Deletes a single file.

```ts
await removeFile(folder.id, "tmp/scratch.txt");
```

### Truncating Files

#### `truncate(folderId, path, len): Promise<void>`

Sets the exact byte length of a file. Shrinks the file if `len` is less than the current size; extends it with zero bytes if `len` is greater.

```ts
await truncate(folder.id, "data.bin", 512);
```

### Utilities

#### `encodeUtf8(value: string): Uint8Array`
#### `decodeUtf8(data: Uint8Array): string`

Convenience wrappers around `TextEncoder` / `TextDecoder` for converting between strings and byte arrays when working with `readFile` / `writeFile`.

## Error Handling

All API functions throw a `ScopedStorageError` on failure. Use `isScopedStorageError` to narrow the type and read the `code` for programmatic handling.

```ts
import { isScopedStorageError } from "tauri-plugin-scoped-storage-api";

try {
  await readTextFile(folder.id, "missing.txt");
} catch (e) {
  if (isScopedStorageError(e)) {
    switch (e.code) {
      case "NOT_FOUND":
        console.log("file does not exist");
        break;
      case "PERMISSION_DENIED":
        console.log("access was revoked");
        break;
      default:
        console.error(e.code, e.message);
    }
  }
}
```

### Error Codes

| Code | When it is thrown |
|------|-------------------|
| `NOT_FOUND` | The file or directory does not exist |
| `FOLDER_NOT_FOUND` | The folder handle ID is not recognised |
| `ALREADY_EXISTS` | A copy/move/mkdir destination already exists |
| `PERMISSION_DENIED` | The app lacks access to the folder or path |
| `CANCELLED` | The user dismissed the folder picker |
| `INVALID_PATH` | The path contains illegal segments such as `..` or an absolute prefix |
| `INVALID_ARGUMENT` | An argument failed validation (e.g. path points to a directory when a file is required) |
| `IO_ERROR` | A low-level platform I/O failure |
| `UNSUPPORTED` | The current platform does not support this operation |
| `NATIVE_ERROR` | An unexpected native error not covered by the codes above |

## Path Rules

All paths must be **relative** to the picked folder. The Rust layer enforces these rules before any native code runs:

- Backslashes (`\`) are normalised to `/`.
- Empty segments and `.` are collapsed (`./notes//file.txt` → `notes/file.txt`).
- `..` is rejected, paths cannot escape the picked folder.
- Absolute paths (starting with `/` or `~`) are rejected.
- URI-style and drive-style prefixes (`content://`, `file://`, `C:`) are rejected.

The native Android and iOS layers apply equivalent checks as a second line of defence.

## Intentionally Unsupported

The following are out of scope for the current version:

- Persistent file handles (`open`, `create`, handle-based `read` / `write` / `close`)
- File watching (`watch`, `watchImmediate`)
- Symbolic link stat (`lstat`)
- Desktop filesystem access

## License

MIT. See [LICENSE](./LICENSE).

Contributor-facing implementation notes live in [DEVELOPER.md](./DEVELOPER.md).
