import Foundation

let scopedStorageNativeErrorPrefix = "SCOPED_STORAGE_ERROR"

enum ScopedStorageErrorCode: String {
    case unsupported = "UNSUPPORTED"
    case invalidPath = "INVALID_PATH"
    case folderNotFound = "FOLDER_NOT_FOUND"
    case notFound = "NOT_FOUND"
    case alreadyExists = "ALREADY_EXISTS"
    case permissionDenied = "PERMISSION_DENIED"
    case cancelled = "CANCELLED"
    case ioError = "IO_ERROR"
    case nativeError = "NATIVE_ERROR"
    case invalidArgument = "INVALID_ARGUMENT"
    case staleBookmark = "STALE_BOOKMARK"
}

struct ScopedStoragePluginError: LocalizedError {
    let code: ScopedStorageErrorCode
    let message: String

    var errorDescription: String? { message }
}

func scopedStorageError(_ code: ScopedStorageErrorCode, _ message: String) -> ScopedStoragePluginError {
    ScopedStoragePluginError(code: code, message: message)
}

func scopedStorageRejectMessage(for error: Error) -> String {
    let scoped: ScopedStoragePluginError
    if let error = error as? ScopedStoragePluginError {
        scoped = error
    } else {
        let nsError = error as NSError
        if nsError.domain == NSCocoaErrorDomain {
            switch CocoaError.Code(rawValue: nsError.code) {
            case .fileNoSuchFile:
                scoped = scopedStorageError(.notFound, nsError.localizedDescription)
            case .fileWriteFileExists:
                scoped = scopedStorageError(.alreadyExists, nsError.localizedDescription)
            case .fileReadNoPermission, .fileWriteNoPermission:
                scoped = scopedStorageError(.permissionDenied, nsError.localizedDescription)
            default:
                scoped = scopedStorageError(.ioError, nsError.localizedDescription)
            }
        } else {
            scoped = scopedStorageError(.nativeError, error.localizedDescription)
        }
    }

    return "\(scopedStorageNativeErrorPrefix):\(scoped.code.rawValue):\(scoped.message)"
}

enum ScopedStoragePath {
    static func split(_ input: String) throws -> [String] {
        let normalized = input.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "\\", with: "/")
        if normalized.isEmpty {
            return []
        }

        if normalized.hasPrefix("/") || normalized.hasPrefix("~") || normalized.contains("\0") {
            throw scopedStorageError(.invalidPath, "Path must be relative")
        }

        var parts: [String] = []
        for (index, rawSegment) in normalized.split(separator: "/", omittingEmptySubsequences: false).enumerated() {
            let segment = String(rawSegment)
            if segment.isEmpty || segment == "." {
                continue
            }
            if segment == ".." {
                throw scopedStorageError(.invalidPath, "Parent segments are not allowed")
            }
            if index == 0 && segment.contains(":") {
                throw scopedStorageError(.invalidPath, "Absolute and URI-style paths are not allowed")
            }
            parts.append(segment)
        }
        return parts
    }

    static func join(_ left: String, _ right: String) -> String {
        [left.trimmingCharacters(in: CharacterSet(charactersIn: "/")),
         right.trimmingCharacters(in: CharacterSet(charactersIn: "/"))]
            .filter { !$0.isEmpty }
            .joined(separator: "/")
    }

    static func parent(_ input: String) throws -> String {
        let parts = try split(input)
        return parts.dropLast().joined(separator: "/")
    }

    static func name(_ input: String) throws -> String {
        guard let last = try split(input).last else {
            throw scopedStorageError(.invalidPath, "Path must not be empty")
        }
        return last
    }
}

struct StoredFolder: Equatable {
    let id: String
    let name: String?
    let uri: String?
}

final class IOSFolderStore {
    private let defaults: UserDefaults
    private let bookmarkPrefix: String
    private let namePrefix: String
    private let uriPrefix: String

    init(
        defaults: UserDefaults = .standard,
        bookmarkPrefix: String = "scoped_storage.bookmark.",
        namePrefix: String = "scoped_storage.name.",
        uriPrefix: String = "scoped_storage.uri."
    ) {
        self.defaults = defaults
        self.bookmarkPrefix = bookmarkPrefix
        self.namePrefix = namePrefix
        self.uriPrefix = uriPrefix
    }

    func save(bookmark: Data, name: String?, uri: String?) -> StoredFolder {
        if let uri, let existing = list().first(where: { $0.uri == uri }) {
            update(id: existing.id, bookmark: bookmark, name: name ?? existing.name, uri: uri)
            return StoredFolder(id: existing.id, name: name ?? existing.name, uri: uri)
        }
        let id = UUID().uuidString
        defaults.set(bookmark, forKey: bookmarkPrefix + id)
        defaults.set(name, forKey: namePrefix + id)
        defaults.set(uri, forKey: uriPrefix + id)
        return StoredFolder(id: id, name: name, uri: uri)
    }

    func getBookmark(id: String) -> Data? {
        defaults.data(forKey: bookmarkPrefix + id)
    }

    func getInfo(id: String) -> StoredFolder? {
        guard defaults.object(forKey: bookmarkPrefix + id) != nil else {
            return nil
        }
        return StoredFolder(
            id: id,
            name: defaults.string(forKey: namePrefix + id),
            uri: defaults.string(forKey: uriPrefix + id)
        )
    }

    func list() -> [StoredFolder] {
        defaults.dictionaryRepresentation().keys
            .filter { $0.hasPrefix(bookmarkPrefix) }
            .map { $0.replacingOccurrences(of: bookmarkPrefix, with: "") }
            .sorted()
            .compactMap(getInfo)
    }

    func update(id: String, bookmark: Data, name: String?, uri: String?) {
        defaults.set(bookmark, forKey: bookmarkPrefix + id)
        defaults.set(name, forKey: namePrefix + id)
        defaults.set(uri, forKey: uriPrefix + id)
    }

    func remove(id: String) {
        defaults.removeObject(forKey: bookmarkPrefix + id)
        defaults.removeObject(forKey: namePrefix + id)
        defaults.removeObject(forKey: uriPrefix + id)
    }
}
