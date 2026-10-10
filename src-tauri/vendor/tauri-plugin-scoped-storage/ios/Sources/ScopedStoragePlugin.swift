import Foundation
import SwiftRs
import UniformTypeIdentifiers
import UIKit
import WebKit
import Tauri

struct FolderHandleDTO: Encodable {
    let id: String
    let name: String?
    let uri: String?
}

struct PickFolderResponseDTO: Encodable {
    let folder: FolderHandleDTO
}

struct ListFoldersResponseDTO: Encodable {
    let folders: [FolderHandleDTO]
}

struct DirEntryDTO: Encodable {
    let name: String
    let path: String
    let isFile: Bool
    let isDir: Bool
    let size: UInt64?
    let mimeType: String?
    let lastModified: Int64?
}

struct FileStatDTO: Encodable {
    let name: String
    let path: String
    let isFile: Bool
    let isDir: Bool
    let size: UInt64?
    let mimeType: String?
    let lastModified: Int64?
}

struct ReadDirResponseDTO: Encodable {
    let entries: [DirEntryDTO]
}

struct ExistsResponseDTO: Encodable {
    let exists: Bool
}

struct ReadFileResponseDTO: Encodable {
    let data: [UInt8]
}

struct ReadTextFileResponseDTO: Encodable {
    let contents: String
}

struct ReadTextFileLinesResponseDTO: Encodable {
    let lines: [String]
}

struct ReadFileArgs: Decodable {
    let folderId: String
    let path: String
}

struct WriteFileArgs: Decodable {
    let folderId: String
    let path: String
    let data: [UInt8]
    let mimeType: String?
    let recursive: Bool?
}

struct WriteTextFileArgs: Decodable {
    let folderId: String
    let path: String
    let contents: String
    let recursive: Bool?
}

struct AppendFileArgs: Decodable {
    let folderId: String
    let path: String
    let data: [UInt8]
    let mimeType: String?
    let create: Bool?
    let recursive: Bool?
}

struct ReadDirArgs: Decodable {
    let folderId: String
    let path: String?
}

struct StatArgs: Decodable {
    let folderId: String
    let path: String
}

struct ExistsArgs: Decodable {
    let folderId: String
    let path: String
}

struct MkdirArgs: Decodable {
    let folderId: String
    let path: String
    let recursive: Bool?
}

struct RemoveFileArgs: Decodable {
    let folderId: String
    let path: String
}

struct RemoveDirArgs: Decodable {
    let folderId: String
    let path: String
    let recursive: Bool?
}

struct CopyArgs: Decodable {
    let fromFolderId: String
    let fromPath: String
    let toFolderId: String
    let toPath: String
}

struct MoveArgs: Decodable {
    let fromFolderId: String
    let fromPath: String
    let toFolderId: String
    let toPath: String
}

struct RenameArgs: Decodable {
    let folderId: String
    let fromPath: String
    let toPath: String
}

struct TruncateArgs: Decodable {
    let folderId: String
    let path: String
    let len: UInt64
}

struct FolderIdArgs: Decodable {
    let folderId: String
}

@available(iOS 14.0, *)
final class ScopedStoragePlugin: Plugin, UIDocumentPickerDelegate {
    private var pendingInvoke: Invoke?
    private let folderStore = IOSFolderStore()

    @objc public func pickFolder(_ invoke: Invoke) {
        DispatchQueue.main.async {
            guard let presenter = self.topPresenter() else {
                invoke.reject("\(scopedStorageNativeErrorPrefix):\(ScopedStorageErrorCode.nativeError.rawValue):No active view controller available to present the folder picker")
                return
            }

            if self.pendingInvoke != nil {
                invoke.reject("\(scopedStorageNativeErrorPrefix):\(ScopedStorageErrorCode.invalidArgument.rawValue):A folder picker request is already in progress")
                return
            }

            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.pendingInvoke = invoke
            presenter.present(picker, animated: true)
        }
    }

    @objc public func forgetFolder(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(FolderIdArgs.self)
            self.folderStore.remove(id: args.folderId)
        }
    }

    @objc public func listFolders(_ invoke: Invoke) {
        let folders = folderStore.list().map(folderDTO)
        invoke.resolve(ListFoldersResponseDTO(folders: folders))
    }

    @objc public func getFolderInfo(_ invoke: Invoke) {
        run(invoke) {
            let args = try invoke.parseArgs(FolderIdArgs.self)
            guard let info = self.folderStore.getInfo(id: args.folderId) else {
                throw scopedStorageError(.folderNotFound, "Folder not found: \(args.folderId)")
            }
            return self.folderDTO(info)
        }
    }

    @objc public func readDir(_ invoke: Invoke) {
        run(invoke) {
            let args = try invoke.parseArgs(ReadDirArgs.self)
            let entries = try self.withFolderURL(folderId: args.folderId) { folderURL in
                let keys: Set<URLResourceKey> = [
                    .nameKey,
                    .isDirectoryKey,
                    .fileSizeKey,
                    .contentModificationDateKey,
                    .contentTypeKey
                ]
                // Stay inside one coordinated read. A path we rebuild ourselves
                // for a folder named `main.typ` is treated as a file — the dot
                // is an extension — and listing it fails. The URL the provider
                // returns while enumerating the parent is the one that opens.
                return try self.coordinatedRead(at: folderURL) { root in
                    try self.listOneLevel(root: root, relPath: args.path, keys: keys)
                }
            }
            return ReadDirResponseDTO(entries: entries)
        }
    }

    @objc public func stat(_ invoke: Invoke) {
        run(invoke) {
            let args = try invoke.parseArgs(StatArgs.self)
            return try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.resolveExistingChildURL(base: folderURL, relPath: args.path)
                return try self.fileStatDTO(
                    url: target,
                    path: args.path,
                    resourceKeys: [
                        .nameKey,
                        .isDirectoryKey,
                        .fileSizeKey,
                        .contentModificationDateKey,
                        .contentTypeKey
                    ]
                )
            }
        }
    }

    @objc public func exists(_ invoke: Invoke) {
        run(invoke) {
            let args = try invoke.parseArgs(ExistsArgs.self)
            let exists = try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.resolveChildURL(base: folderURL, relPath: args.path)
                return FileManager.default.fileExists(atPath: target.path)
            }
            return ExistsResponseDTO(exists: exists)
        }
    }

    @objc public func readFile(_ invoke: Invoke) {
        run(invoke) {
            let args = try invoke.parseArgs(ReadFileArgs.self)
            let data = try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.requireFile(base: folderURL, relPath: args.path)
                return try self.coordinatedRead(at: target) { try Data(contentsOf: $0) }
            }
            return ReadFileResponseDTO(data: Array(data))
        }
    }

    @objc public func readTextFile(_ invoke: Invoke) {
        run(invoke) {
            let args = try invoke.parseArgs(ReadFileArgs.self)
            let contents = try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.requireFile(base: folderURL, relPath: args.path)
                let data = try self.coordinatedRead(at: target) { try Data(contentsOf: $0) }
                guard let string = String(data: data, encoding: .utf8) else {
                    throw scopedStorageError(.ioError, "File is not valid UTF-8")
                }
                return string
            }
            return ReadTextFileResponseDTO(contents: contents)
        }
    }

    @objc public func readTextFileLines(_ invoke: Invoke) {
        run(invoke) {
            let args = try invoke.parseArgs(ReadFileArgs.self)
            let lines = try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.requireFile(base: folderURL, relPath: args.path)
                let data = try self.coordinatedRead(at: target) { try Data(contentsOf: $0) }
                guard let string = String(data: data, encoding: .utf8) else {
                    throw scopedStorageError(.ioError, "File is not valid UTF-8")
                }
                return string.split(whereSeparator: \.isNewline).map(String.init)
            }
            return ReadTextFileLinesResponseDTO(lines: lines)
        }
    }

    @objc public func writeFile(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(WriteFileArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.resolveChildURL(base: folderURL, relPath: args.path)
                try self.prepareParentDirectory(for: target, recursive: args.recursive ?? false)
                try self.coordinatedWrite(at: target, replace: true) { destination in
                    try Data(args.data).write(to: destination, options: .atomic)
                }
            }
        }
    }

    @objc public func writeTextFile(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(WriteTextFileArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.resolveChildURL(base: folderURL, relPath: args.path)
                try self.prepareParentDirectory(for: target, recursive: args.recursive ?? false)
                try self.coordinatedWrite(at: target, replace: true) { destination in
                    guard let data = args.contents.data(using: .utf8) else {
                        throw scopedStorageError(.ioError, "Failed to encode UTF-8 text")
                    }
                    try data.write(to: destination, options: .atomic)
                }
            }
        }
    }

    @objc public func appendFile(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(AppendFileArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.resolveChildURL(base: folderURL, relPath: args.path)
                let fileManager = FileManager.default
                if !fileManager.fileExists(atPath: target.path) {
                    guard args.create != false else {
                        throw scopedStorageError(.notFound, "File not found: \(args.path)")
                    }
                    try self.prepareParentDirectory(for: target, recursive: args.recursive ?? false)
                    fileManager.createFile(atPath: target.path, contents: Data(), attributes: nil)
                }
                try self.coordinatedWrite(at: target) { destination in
                    let handle = try FileHandle(forWritingTo: destination)
                    defer { handle.closeFile() }
                    handle.seekToEndOfFile()
                    handle.write(Data(args.data))
                }
            }
        }
    }

    @objc public func mkdir(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(MkdirArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let dir = try self.resolveChildURL(base: folderURL, relPath: args.path, isDirectory: true)
                let exists = FileManager.default.fileExists(atPath: dir.path)
                if exists && !(args.recursive ?? false) {
                    throw scopedStorageError(.alreadyExists, "Directory already exists: \(args.path)")
                }
                try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: args.recursive ?? false)
            }
        }
    }

    @objc public func removeFile(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(RemoveFileArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.requireFile(base: folderURL, relPath: args.path)
                try FileManager.default.removeItem(at: target)
            }
        }
    }

    @objc public func removeDir(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(RemoveDirArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.requireDirectory(base: folderURL, relPath: args.path)
                if !(args.recursive ?? false) {
                    let contents = try FileManager.default.contentsOfDirectory(atPath: target.path)
                    if !contents.isEmpty {
                        throw scopedStorageError(.invalidArgument, "Directory not empty")
                    }
                }
                try FileManager.default.removeItem(at: target)
            }
        }
    }

    @objc public func copy(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(CopyArgs.self)
            try self.withResolvedTransferURLs(
                fromFolderId: args.fromFolderId,
                fromPath: args.fromPath,
                toFolderId: args.toFolderId,
                toPath: args.toPath
            ) { source, destination in
                try self.coordinatedCopy(from: source, to: destination)
            }
        }
    }

    @objc public func move(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(MoveArgs.self)
            try self.withResolvedTransferURLs(
                fromFolderId: args.fromFolderId,
                fromPath: args.fromPath,
                toFolderId: args.toFolderId,
                toPath: args.toPath
            ) { source, destination in
                // Use coordinatedMove; falls back internally to copyThenDelete only when
                // the coordinator itself cannot complete the atomic move.
                do {
                    try self.coordinatedMove(from: source, to: destination)
                } catch {
                    try self.copyThenDelete(from: source, to: destination)
                }
            }
        }
    }

    @objc public func rename(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(RenameArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let source = try self.resolveExistingChildURL(base: folderURL, relPath: args.fromPath)
                let destination = try self.resolveChildURL(base: folderURL, relPath: args.toPath)
                try self.ensureMissing(destination, path: args.toPath)
                try self.prepareParentDirectory(for: destination, recursive: true)
                try self.copyThenDelete(from: source, to: destination)
            }
        }
    }

    @objc public func truncate(_ invoke: Invoke) {
        runVoid(invoke) {
            let args = try invoke.parseArgs(TruncateArgs.self)
            try self.withFolderURL(folderId: args.folderId) { folderURL in
                let target = try self.requireFile(base: folderURL, relPath: args.path)
                try self.coordinatedWrite(at: target) { destination in
                    let handle = try FileHandle(forUpdating: destination)
                    defer { handle.closeFile() }

                    let attributes = try FileManager.default.attributesOfItem(atPath: destination.path)
                    let currentSize = (attributes[.size] as? NSNumber)?.uint64Value ?? 0
                    if args.len <= currentSize {
                        handle.truncateFile(atOffset: args.len)
                    } else {
                        handle.seekToEndOfFile()
                        var remaining = args.len - currentSize
                        let chunk = Data(repeating: 0, count: 8192)
                        while remaining > 0 {
                            let writeSize = Int(min(remaining, UInt64(chunk.count)))
                            handle.write(chunk.prefix(writeSize))
                            remaining -= UInt64(writeSize)
                        }
                    }
                }
            }
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else {
            pendingInvoke?.reject("\(scopedStorageNativeErrorPrefix):\(ScopedStorageErrorCode.cancelled.rawValue):No folder selected")
            pendingInvoke = nil
            return
        }

        do {
            let stored = try self.withSecurityScopedAccess(to: url) { accessibleURL in
                let bookmark = try accessibleURL.bookmarkData(
                    options: [],
                    includingResourceValuesForKeys: nil,
                    relativeTo: nil
                )
                let name = (try? accessibleURL.resourceValues(forKeys: [.nameKey]).name) ?? accessibleURL.lastPathComponent
                return self.folderStore.save(bookmark: bookmark, name: name, uri: accessibleURL.absoluteString)
            }
            pendingInvoke?.resolve(PickFolderResponseDTO(folder: folderDTO(stored)))
        } catch {
            pendingInvoke?.reject(scopedStorageRejectMessage(for: error))
        }

        pendingInvoke = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingInvoke?.reject("\(scopedStorageNativeErrorPrefix):\(ScopedStorageErrorCode.cancelled.rawValue):User cancelled")
        pendingInvoke = nil
    }

    private func run<T: Encodable>(_ invoke: Invoke, _ block: () throws -> T) {
        do {
            invoke.resolve(try block())
        } catch {
            invoke.reject(scopedStorageRejectMessage(for: error))
        }
    }

    private func runVoid(_ invoke: Invoke, _ block: () throws -> Void) {
        do {
            try block()
            invoke.resolve()
        } catch {
            invoke.reject(scopedStorageRejectMessage(for: error))
        }
    }

    private func folderDTO(_ folder: StoredFolder) -> FolderHandleDTO {
        FolderHandleDTO(id: folder.id, name: folder.name, uri: folder.uri)
    }

    private func withFolderURL<T>(folderId: String, _ block: (URL) throws -> T) throws -> T {
        guard let bookmark = folderStore.getBookmark(id: folderId) else {
            throw scopedStorageError(.folderNotFound, "Folder not found: \(folderId)")
        }

        var stale = false
        let url = try URL(
            resolvingBookmarkData: bookmark,
            options: [],
            relativeTo: nil,
            bookmarkDataIsStale: &stale
        )

        return try withSecurityScopedAccess(to: url) { accessibleURL in
            if stale {
                let refreshed = try accessibleURL.bookmarkData(
                    options: [],
                    includingResourceValuesForKeys: nil,
                    relativeTo: nil
                )
                let name = (try? accessibleURL.resourceValues(forKeys: [.nameKey]).name) ?? accessibleURL.lastPathComponent
                folderStore.update(id: folderId, bookmark: refreshed, name: name, uri: accessibleURL.absoluteString)
            }
            return try block(accessibleURL)
        }
    }

    /// `defer` inside `if accessStarted` runs when that `if` ends, not when the
    /// surrounding function returns — so the plugin was dropping the security
    /// scope before bookmark creation and every later read/write.
    private func withSecurityScopedAccess<T>(to url: URL, _ block: (URL) throws -> T) throws -> T {
        let accessStarted = url.startAccessingSecurityScopedResource()
        defer {
            if accessStarted {
                url.stopAccessingSecurityScopedResource()
            }
        }
        return try block(url)
    }

    private func withTwoFolderURLs<T>(
        fromFolderId: String,
        toFolderId: String,
        _ block: (URL, URL) throws -> T
    ) throws -> T {
        try withFolderURL(folderId: fromFolderId) { fromURL in
            try withFolderURL(folderId: toFolderId) { toURL in
                try block(fromURL, toURL)
            }
        }
    }

    private func withResolvedTransferURLs<T>(
        fromFolderId: String,
        fromPath: String,
        toFolderId: String,
        toPath: String,
        _ block: (URL, URL) throws -> T
    ) throws -> T {
        if fromFolderId == toFolderId {
            return try withFolderURL(folderId: fromFolderId) { folderURL in
                let source = try resolveExistingChildURL(base: folderURL, relPath: fromPath)
                let destination = try resolveChildURL(base: folderURL, relPath: toPath)
                try ensureMissing(destination, path: toPath)
                try prepareParentDirectory(for: destination, recursive: true)
                return try block(source, destination)
            }
        }

        return try withTwoFolderURLs(fromFolderId: fromFolderId, toFolderId: toFolderId) { fromURL, toURL in
            let source = try resolveExistingChildURL(base: fromURL, relPath: fromPath)
            let destination = try resolveChildURL(base: toURL, relPath: toPath)
            try ensureMissing(destination, path: toPath)
            try prepareParentDirectory(for: destination, recursive: true)
            return try block(source, destination)
        }
    }

    /// One directory level. A folder named `main.typ` under `versions/` is a
    /// directory, not a file. `contentsOfDirectory` on a rebuilt path often
    /// refuses it; the deep listing of the parent still contains the files.
    private func listOneLevel(root: URL, relPath: String?, keys: Set<URLResourceKey>) throws -> [DirEntryDTO] {
        let base = relPath ?? ""
        let dir = try resolveListedDirectory(root: root, relPath: relPath)
        if let direct = try? FileManager.default.contentsOfDirectory(
            at: dir,
            includingPropertiesForKeys: Array(keys),
            options: []
        ), !direct.isEmpty {
            return direct.compactMap { self.dirEntryOrNil(url: $0, basePath: base, resourceKeys: keys) }
        }
        let nested = immediateChildren(of: dir, basePath: base, keys: keys)
        if !nested.isEmpty { return nested }
        guard let relPath, !relPath.isEmpty else { return [] }
        let parentPath = (relPath as NSString).deletingLastPathComponent
        let leaf = (relPath as NSString).lastPathComponent
        let parentURL: URL
        if parentPath.isEmpty || parentPath == "." {
            parentURL = root
        } else {
            parentURL = (try? resolveListedDirectory(root: root, relPath: parentPath)) ?? root
        }
        let prefix = leaf + "/"
        return relativePaths(under: parentURL).compactMap { rel in
            guard rel.hasPrefix(prefix) else { return nil }
            let rest = String(rel.dropFirst(prefix.count))
            guard !rest.isEmpty, !rest.contains("/") else { return nil }
            return DirEntryDTO(
                name: rest,
                path: ScopedStoragePath.join(relPath, rest),
                isFile: true,
                isDir: false,
                size: nil,
                mimeType: nil,
                lastModified: nil
            )
        }
    }

    private func immediateChildren(of directory: URL, basePath: String, keys: Set<URLResourceKey>) -> [DirEntryDTO] {
        guard let enumerator = FileManager.default.enumerator(
            at: directory,
            includingPropertiesForKeys: Array(keys),
            options: [],
            errorHandler: { _, _ in true }
        ) else { return [] }
        let base = directory.path.hasSuffix("/") ? directory.path : directory.path + "/"
        var out: [DirEntryDTO] = []
        while let item = enumerator.nextObject() as? URL {
            let path = item.path
            guard path.hasPrefix(base) else { continue }
            let rel = String(path.dropFirst(base.count))
            guard !rel.isEmpty, !rel.contains("/") else { continue }
            if let entry = dirEntryOrNil(url: item, basePath: basePath, resourceKeys: keys) {
                out.append(entry)
            }
        }
        return out
    }

    private func relativePaths(under directory: URL) -> [String] {
        guard let enumerator = FileManager.default.enumerator(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [],
            errorHandler: { _, _ in true }
        ) else { return [] }
        let base = directory.path.hasSuffix("/") ? directory.path : directory.path + "/"
        var out: [String] = []
        while let item = enumerator.nextObject() as? URL {
            let path = item.path
            guard path.hasPrefix(base) else { continue }
            let rel = String(path.dropFirst(base.count))
            if !rel.isEmpty { out.append(rel) }
        }
        return out
    }

    private func dirEntryOrNil(url: URL, basePath: String, resourceKeys: Set<URLResourceKey>) -> DirEntryDTO? {
        let values = try? url.resourceValues(forKeys: resourceKeys)
        let name = values?.name ?? url.lastPathComponent
        guard !name.isEmpty else { return nil }
        let isDir = values?.isDirectory ?? false
        return DirEntryDTO(
            name: name,
            path: ScopedStoragePath.join(basePath, name),
            isFile: !isDir,
            isDir: isDir,
            size: values?.fileSize.map(UInt64.init),
            mimeType: values?.contentType?.preferredMIMEType,
            lastModified: values?.contentModificationDate.map { Int64($0.timeIntervalSince1970) }
        )
    }

    /// Walk `relPath` using the URLs from each directory listing.
    /// Valid only inside the coordinated read that produced `root`.
    private func resolveListedDirectory(root: URL, relPath: String?) throws -> URL {
        guard let relPath, !relPath.isEmpty else { return root }
        let components = try ScopedStoragePath.split(relPath)
        var url = root
        for component in components {
            let children = try FileManager.default.contentsOfDirectory(
                at: url,
                includingPropertiesForKeys: [.nameKey],
                options: []
            )
            if let child = children.first(where: { $0.lastPathComponent == component }) {
                url = child
            } else {
                url.appendPathComponent(component, isDirectory: true)
            }
        }
        return url
    }

    private func resolveChildURL(base: URL, relPath: String, isDirectory: Bool = false) throws -> URL {
        let components = try ScopedStoragePath.split(relPath)
        if components.isEmpty {
            throw scopedStorageError(.invalidPath, "Path must not be empty")
        }

        var url = base
        for (i, component) in components.enumerated() {
            let isLast = i == components.index(before: components.endIndex)
            url.appendPathComponent(component, isDirectory: isDirectory && isLast)
        }
        return url
    }

    private func resolveExistingChildURL(base: URL, relPath: String) throws -> URL {
        let url = try resolveChildURL(base: base, relPath: relPath)
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw scopedStorageError(.notFound, "Path not found: \(relPath)")
        }
        return url
    }

    private func requireFile(base: URL, relPath: String) throws -> URL {
        let url = try resolveExistingChildURL(base: base, relPath: relPath)
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
            throw scopedStorageError(.invalidArgument, "Path is not a file")
        }
        return url
    }

    private func requireDirectory(base: URL, relPath: String) throws -> URL {
        let url = try resolveExistingChildURL(base: base, relPath: relPath)
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            throw scopedStorageError(.invalidArgument, "Path is not a directory")
        }
        return url
    }

    private func prepareParentDirectory(for url: URL, recursive: Bool) throws {
        let parent = url.deletingLastPathComponent()
        let exists = FileManager.default.fileExists(atPath: parent.path)
        if exists {
            return
        }
        guard recursive else {
            throw scopedStorageError(.notFound, "Parent directory missing")
        }
        try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
    }

    private func ensureMissing(_ url: URL, path: String) throws {
        if FileManager.default.fileExists(atPath: url.path) {
            throw scopedStorageError(.alreadyExists, "Destination already exists: \(path)")
        }
    }

    private func coordinatedRead<T>(at url: URL, _ block: (URL) throws -> T) throws -> T {
        var coordinatorError: NSError?
        var result: T?
        var blockError: Error?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(
            readingItemAt: url,
            options: [],
            error: &coordinatorError
        ) { readingURL in
            do {
                result = try block(readingURL)
            } catch {
                blockError = error
            }
        }

        if let coordinatorError {
            throw coordinatorError
        }
        if let blockError {
            throw blockError
        }
        return result!
    }

    private func coordinatedWrite(at url: URL, replace: Bool = false, _ block: (URL) throws -> Void) throws {
        var coordinatorError: NSError?
        var blockError: Error?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(
            writingItemAt: url,
            options: replace ? .forReplacing : .forMerging,
            error: &coordinatorError
        ) { destination in
            do {
                try block(destination)
            } catch {
                blockError = error
            }
        }

        if let coordinatorError {
            throw coordinatorError
        }
        if let blockError {
            throw blockError
        }
    }

    private func coordinatedCopy(from source: URL, to destination: URL) throws {
        var coordinatorError: NSError?
        var operationError: Error?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(
            readingItemAt: source,
            options: [],
            writingItemAt: destination,
            options: .forMerging,
            error: &coordinatorError
        ) { sourceURL, destinationURL in
            do {
                try FileManager.default.copyItem(at: sourceURL, to: destinationURL)
            } catch {
                operationError = error
            }
        }

        if let coordinatorError {
            throw coordinatorError
        }
        if let operationError {
            throw operationError
        }
    }

    private func coordinatedMove(from source: URL, to destination: URL) throws {
        var coordinatorError: NSError?
        var operationError: Error?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(
            writingItemAt: source,
            options: .forMoving,
            writingItemAt: destination,
            options: .forMoving,
            error: &coordinatorError
        ) { sourceURL, destinationURL in
            do {
                try FileManager.default.moveItem(at: sourceURL, to: destinationURL)
            } catch {
                operationError = error
            }
        }

        if let coordinatorError {
            throw coordinatorError
        }
        if let operationError {
            // Rethrow the original move error rather than attempting copyThenDelete,
            // which would fail with ALREADY_EXISTS if the coordinator created the destination.
            throw operationError
        }
    }

    private func copyThenDelete(from source: URL, to destination: URL) throws {
        try coordinatedCopy(from: source, to: destination)
        try coordinatedDelete(at: source)
    }

    private func coordinatedDelete(at url: URL) throws {
        var coordinatorError: NSError?
        var operationError: Error?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(
            writingItemAt: url,
            options: .forDeleting,
            error: &coordinatorError
        ) { targetURL in
            do {
                try FileManager.default.removeItem(at: targetURL)
            } catch {
                operationError = error
            }
        }

        if let coordinatorError {
            throw coordinatorError
        }
        if let operationError {
            throw operationError
        }
    }

    private func dirEntryDTO(
        url: URL,
        basePath: String,
        resourceKeys: Set<URLResourceKey>
    ) throws -> DirEntryDTO {
        let values = try url.resourceValues(forKeys: resourceKeys)
        let name = values.name ?? url.lastPathComponent
        let isDir = values.isDirectory ?? false
        return DirEntryDTO(
            name: name,
            path: ScopedStoragePath.join(basePath, name),
            isFile: !isDir,
            isDir: isDir,
            size: values.fileSize.map(UInt64.init),
            mimeType: values.contentType?.preferredMIMEType,
            lastModified: values.contentModificationDate.map { Int64($0.timeIntervalSince1970) }
        )
    }

    private func fileStatDTO(
        url: URL,
        path: String,
        resourceKeys: Set<URLResourceKey>
    ) throws -> FileStatDTO {
        let values = try url.resourceValues(forKeys: resourceKeys)
        let isDir = values.isDirectory ?? false
        return FileStatDTO(
            name: values.name ?? url.lastPathComponent,
            path: path,
            isFile: !isDir,
            isDir: isDir,
            size: values.fileSize.map(UInt64.init),
            mimeType: values.contentType?.preferredMIMEType,
            lastModified: values.contentModificationDate.map { Int64($0.timeIntervalSince1970) }
        )
    }

    private func topPresenter() -> UIViewController? {
        var controller = manager.viewController
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }
}

@_cdecl("init_plugin_scoped_storage")
@available(iOS 14.0, *)
func initPluginScopedStorage() -> Plugin {
    ScopedStoragePlugin()
}
