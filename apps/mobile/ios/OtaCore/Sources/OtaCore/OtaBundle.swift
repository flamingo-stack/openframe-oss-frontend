import CryptoKit
import Foundation

/// A file's bytes arrive before the rest of the archive has been checked, so whatever a sink keeps
/// is good only once `OtaBundle.unpack` returns.
public protocol OtaBundleSink: AnyObject {
    /// `path` is relative, `/`-separated printable ASCII, with no empty, `.` or `..` segment, and
    /// collides with no earlier path even on a volume that ignores case.
    func beginFile(path: String, size: Int64) throws
    func write(_ bytes: UnsafeRawBufferPointer) throws
    func endFile() throws
}

public enum OtaBundle {
    static let chunkSize = 64 * 1024

    /// The fault precedence of docs/ota.md: SIZE, then SHA256, before anything is decompressed; then
    /// XZ over TAR over the first entry fault in archive order (ENTRY_TYPE, ENTRY_NAME, DUPLICATE)
    /// over NO_INDEX, HAS_ENV, NO_HEAD. Returns the root `index.html`, which has passed
    /// `OtaEnv.checkTarget`.
    ///
    /// Throws an `OtaError` for a refusal. Any other error is the file's, the sink's (I/O) or the
    /// device's (`XZDecoderUnavailable`) and says nothing about the bundle.
    public static func unpack(fileAt url: URL, size: Int64, sha256: String, into sink: OtaBundleSink) throws -> [UInt8] {
        var hasher = SHA256()
        var length: Int64 = 0
        try readChunks(of: url) { chunk in
            hasher.update(bufferPointer: chunk)
            length += Int64(chunk.count)
        }
        guard length == size else {
            throw OtaError(.size, "the bundle is \(length) bytes, the manifest says \(size)")
        }
        let digest = hasher.finalize().map { String(format: "%02x", $0) }.joined()
        guard digest.utf8.elementsEqual(sha256.utf8) else {
            throw OtaError(.sha256, "the bundle's SHA-256 is \(digest), the manifest says \(sha256)")
        }

        let decoder = try XZDecoder()
        let entries = EntryChecker(sink: sink)
        var tar = TarReader()
        var tarFault: OtaError?
        // After a TAR fault the tar is read no further, but the xz stream is still decoded to its
        // end, because an XZ fault outranks it.
        let decoded: (UnsafeBufferPointer<UInt8>) throws -> Void = { bytes in
            guard tarFault == nil else { return }
            do {
                try tar.read(bytes, handler: entries)
            } catch let fault as OtaError {
                tarFault = fault
            }
        }
        try readChunks(of: url) { chunk in
            try decoder.decode(chunk, decoded: decoded)
        }
        try decoder.finish(decoded: decoded)
        if let tarFault { throw tarFault }
        try tar.finish()
        return try entries.finish()
    }

    private static func readChunks(of url: URL, _ body: (UnsafeRawBufferPointer) throws -> Void) throws {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var more = true
        while more {
            // Each chunk is autoreleased: without a pool of its own it would live until the
            // caller's drains, and the whole archive would be in memory by the end.
            more = try autoreleasepool {
                guard let chunk = try handle.read(upToCount: chunkSize), !chunk.isEmpty else { return false }
                try chunk.withUnsafeBytes(body)
                return true
            }
        }
    }
}

/// After the first entry fault no entry is checked or handed to the sink, but the tar is read on:
/// a TAR fault further on outranks it.
private final class EntryChecker: TarEntryHandler {
    private static let regularFile = UInt8(ascii: "0")
    private static let indexName = Array("index.html".utf8)
    private static let maxPathLength = 255

    private let sink: OtaBundleSink
    private var fault: OtaError?
    // Lower-cased: the iOS Simulator's volume ignores case, so Index.html would land on index.html.
    private var files = Set<[UInt8]>()
    private var directories = Set<[UInt8]>()
    private var writing = false
    private var writingIndex = false
    private var index: [UInt8]?

    init(sink: OtaBundleSink) {
        self.sink = sink
    }

    func entryBegan(type: UInt8, path: [UInt8], size: Int64) throws {
        guard fault == nil else { return }
        guard type == Self.regularFile else {
            fault = OtaError(.entryType, "an entry is not a regular file")
            return
        }
        guard Self.isSafeName(path) else {
            fault = OtaError(.entryName, "an entry's path is not one a shell may write")
            return
        }
        let key = path.map { ($0 >= UInt8(ascii: "A") && $0 <= UInt8(ascii: "Z")) ? $0 + 0x20 : $0 }
        var parents: [[UInt8]] = []
        for (offset, byte) in key.enumerated() where byte == UInt8(ascii: "/") {
            parents.append(Array(key[..<offset]))
        }
        guard !files.contains(key), !directories.contains(key), !parents.contains(where: files.contains) else {
            fault = OtaError(.duplicate, "\(String(decoding: path, as: UTF8.self)) collides with another path")
            return
        }
        files.insert(key)
        directories.formUnion(parents)
        writingIndex = path == Self.indexName
        if writingIndex { index = [] }
        writing = true
        try sink.beginFile(path: String(decoding: path, as: UTF8.self), size: size)
    }

    func entryData(_ bytes: UnsafeBufferPointer<UInt8>) throws {
        guard writing else { return }
        if writingIndex {
            index?.append(contentsOf: bytes)
        }
        try sink.write(UnsafeRawBufferPointer(bytes))
    }

    func entryEnded() throws {
        guard writing else { return }
        writing = false
        try sink.endFile()
    }

    func finish() throws -> [UInt8] {
        if let fault { throw fault }
        guard let index else { throw OtaError(.noIndex, "no index.html at the root of the bundle") }
        try OtaEnv.checkTarget(index)
        return index
    }

    /// No empty, `.` or `..` segment: so no absolute path, no directory entry, no way out of the
    /// bundle directory.
    private static func isSafeName(_ path: [UInt8]) -> Bool {
        guard !path.isEmpty, path.count <= maxPathLength,
              path.allSatisfy({ $0 >= 0x21 && $0 <= 0x7E && $0 != UInt8(ascii: "\\") })
        else { return false }
        let dot = UInt8(ascii: ".")
        return path.split(separator: UInt8(ascii: "/"), omittingEmptySubsequences: false).allSatisfy { segment in
            !segment.isEmpty && !segment.elementsEqual([dot]) && !segment.elementsEqual([dot, dot])
        }
    }
}

extension Array where Element == UInt8 {
    func offset(of literal: [UInt8], from start: Int = 0) -> Int? {
        guard !literal.isEmpty, count >= literal.count, start <= count - literal.count else { return nil }
        for index in start...(count - literal.count) where self[index] == literal[0] {
            if self[index..<index + literal.count].elementsEqual(literal) { return index }
        }
        return nil
    }
}
