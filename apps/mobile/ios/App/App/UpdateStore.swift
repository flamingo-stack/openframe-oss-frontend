import Foundation
import OtaCore

/**
 * Where the over-the-air updater keeps its files: `Application Support/ota/`,
 * left out of backups (a restored bundle would run under another device's
 * state, and every one of them downloads again in seconds).
 *
 *     state.json          what boots (OtaState), written atomically
 *     bundles/<version>/  verified, unpacked bundles, the env already in index.html
 *     staging/            a check's work area, wiped when one starts and at boot
 *
 * Every directory and file here has no data protection (`unprotected`). The
 * default class cannot be read before the first unlock after a reboot, and a
 * process the system launches then (a notification action, a silent push)
 * would boot the built-in bundle and keep showing it once the user opens the
 * app. Nothing here is secret: released web code, host names, version numbers.
 *
 * Dumb file access only: which bundle boots and what a check may change is
 * decided by `OtaRules`, on `NativeUpdate`'s queue.
 */
struct UpdateStore {
    enum StateRead {
        case state(OtaState)
        /// The file is there and cannot be read right now (before the first
        /// unlock after a reboot, an I/O error). Not the same as no file.
        case unreadable(Error)
    }

    /// For every directory and file made under `ota/`, the staged ones included:
    /// a rename into `bundles/` keeps the class a file was made with.
    static let unprotected: [FileAttributeKey: Any] = [.protectionKey: FileProtectionType.none]

    private static let indexName = "index.html"

    private let root: URL
    private var stateFile: URL { root.appendingPathComponent("state.json") }
    private var bundles: URL { root.appendingPathComponent("bundles", isDirectory: true) }
    let staging: URL

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        root = support.appendingPathComponent("ota", isDirectory: true)
        staging = root.appendingPathComponent("staging", isDirectory: true)
    }

    func readState() -> StateRead {
        do {
            return .state(OtaState.parse(Array(try Data(contentsOf: stateFile))))
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            return .state(OtaState())
        } catch {
            return .unreadable(error)
        }
    }

    func writeState(_ state: OtaState) throws {
        try makeDirectory(root)
        try Data(state.serialized()).write(to: stateFile, options: [.atomic, .noFileProtection])
    }

    func bundleDirectory(_ version: OtaVersion) -> URL {
        bundles.appendingPathComponent(version.description, isDirectory: true)
    }

    /// Whether this binary can serve a bundle: its directory holds an
    /// `index.html` that carries `envElement`, the built-in page's own. One
    /// unpacked by a binary built for another env carries that one's, and a
    /// binary without an element can serve none.
    func isUsable(_ version: OtaVersion, envElement: [UInt8]?) -> Bool {
        let index = bundleDirectory(version).appendingPathComponent(Self.indexName)
        guard let envElement, let page = try? Data(contentsOf: index) else { return false }
        return OtaEnv.page(Array(page), carries: envElement)
    }

    func bundleNames() -> [String] {
        (try? FileManager.default.contentsOfDirectory(atPath: bundles.path)) ?? []
    }

    func removeBundles(named names: [String]) {
        for name in names {
            let directory = bundles.appendingPathComponent(name, isDirectory: true)
            // The index first: a deletion cut short must not leave a directory
            // that still passes for a bundle and is adopted with files missing.
            try? FileManager.default.removeItem(at: directory.appendingPathComponent(Self.indexName))
            try? FileManager.default.removeItem(at: directory)
        }
    }

    /// An empty work area for a check.
    func resetStaging() throws {
        wipeStaging()
        try makeDirectory(staging)
    }

    func wipeStaging() {
        try? FileManager.default.removeItem(at: staging)
    }

    /// Moves a verified, unpacked bundle from staging into place: one rename
    /// on one volume, so `bundles/<version>` is either absent or whole.
    func install(staged: URL, as version: OtaVersion) throws {
        try makeDirectory(bundles)
        let destination = bundleDirectory(version)
        // Whatever is there is not usable (a bundle that is, is adopted and never
        // downloaded again), and nothing refers to it.
        try? FileManager.default.removeItem(at: destination)
        try FileManager.default.moveItem(at: staged, to: destination)
    }

    /// `root`, or a directory right under it.
    private func makeDirectory(_ directory: URL) throws {
        let files = FileManager.default
        // Application Support is not ours: made first, so that it keeps the
        // default protection, which the files others create in it inherit.
        try files.createDirectory(at: root.deletingLastPathComponent(), withIntermediateDirectories: true)
        for made in directory == root ? [root] : [root, directory] {
            try files.createDirectory(at: made, withIntermediateDirectories: true, attributes: Self.unprotected)
            // Also one that an earlier build made with the default class. A class
            // that cannot be set leaves the files as they were before: unreadable
            // until the first unlock, when the built-in bundle boots.
            try? files.setAttributes(Self.unprotected, ofItemAtPath: made.path)
        }
        var root = root
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try root.setResourceValues(values)
    }
}

/// Writes a bundle's files under one directory as `OtaBundle.unpack` reads
/// them. Files get the shell's own permissions: nothing from a tar header
/// reaches this type.
final class DirectorySink: OtaBundleSink {
    private let root: URL
    private var made = Set<String>()
    private var handle: FileHandle?

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func beginFile(path: String, size: Int64) throws {
        let file = root.appendingPathComponent(path).standardizedFileURL
        // The reader hands over only relative paths without `..`; this holds
        // the line where bytes reach the disk, whatever the reader does.
        guard file.path.hasPrefix(root.path + "/") else {
            throw CocoaError(.fileWriteInvalidFileName)
        }
        let directory = file.deletingLastPathComponent()
        if made.insert(directory.path).inserted {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: UpdateStore.unprotected)
        }
        guard FileManager.default.createFile(atPath: file.path, contents: nil, attributes: UpdateStore.unprotected) else {
            throw CocoaError(.fileWriteUnknown)
        }
        handle = try FileHandle(forWritingTo: file)
    }

    func write(_ bytes: UnsafeRawBufferPointer) throws {
        guard let handle, let base = bytes.baseAddress, bytes.count > 0 else { return }
        let data = Data(bytesNoCopy: UnsafeMutableRawPointer(mutating: base), count: bytes.count, deallocator: .none)
        try handle.write(contentsOf: data)
    }

    func endFile() throws {
        try handle?.close()
        handle = nil
    }
}
