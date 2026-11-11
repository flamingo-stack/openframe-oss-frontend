import Compression
import CryptoKit
import Foundation
import XCTest
@testable import OtaCore

/// The shared bundles are a few hundred bytes, so each reaches the decoder and the tar reader in
/// one piece. A real bundle is megabytes: these run the same readers over inputs cut at every
/// kind of seam.
final class StreamingTests: XCTestCase {
    private final class Events: TarEntryHandler {
        var files: [RecordingSink.File] = []
        private var path = ""
        private var size: Int64 = 0
        private var hasher = SHA256()
        private var written: Int64 = 0

        func entryBegan(type: UInt8, path: [UInt8], size: Int64) throws {
            XCTAssertEqual(type, UInt8(ascii: "0"))
            self.path = String(decoding: path, as: UTF8.self)
            self.size = size
            hasher = SHA256()
            written = 0
        }

        func entryData(_ bytes: UnsafeBufferPointer<UInt8>) throws {
            hasher.update(bufferPointer: UnsafeRawBufferPointer(bytes))
            written += Int64(bytes.count)
        }

        func entryEnded() throws {
            XCTAssertEqual(written, size, path)
            files.append(.init(path: path, size: size, sha256: hex(hasher.finalize())))
        }
    }

    private func typicalCase() throws -> (archive: [UInt8], files: [RecordingSink.File]) {
        let testCase = try XCTUnwrap(try Fixtures.cases("bundle-cases.json").first { $0.caseName == "a typical bundle" })
        let archive = Array(try Data(contentsOf: Fixtures.directory.appendingPathComponent(try XCTUnwrap(testCase["bundle"]?.text))))
        let files = try XCTUnwrap(testCase["expect"]?["files"]?.items).map {
            RecordingSink.File(path: try XCTUnwrap($0["path"]?.text), size: try XCTUnwrap($0["size"]?.integer), sha256: try XCTUnwrap($0["sha256"]?.text))
        }
        return (archive, files)
    }

    private func decode(_ archive: [UInt8], pieceSize: Int) throws -> [UInt8] {
        let decoder = try XZDecoder()
        var tar: [UInt8] = []
        var position = 0
        while position < archive.count {
            let piece = Array(archive[position..<min(position + pieceSize, archive.count)])
            try piece.withUnsafeBytes { try decoder.decode($0) { tar.append(contentsOf: $0) } }
            position += pieceSize
        }
        try decoder.finish { tar.append(contentsOf: $0) }
        return tar
    }

    func testTheDecoderGivesTheSameTarHoweverTheArchiveIsCut() throws {
        let archive = try typicalCase().archive
        let whole = try decode(archive, pieceSize: archive.count)
        XCTAssertFalse(whole.isEmpty)
        for pieceSize in [1, 2, 5, 6, 7, 64, archive.count - 1] {
            XCTAssertEqual(try decode(archive, pieceSize: pieceSize), whole, "pieces of \(pieceSize)")
        }
    }

    func testTheDecoderRefusesWhatIsNotOneWholeStreamHoweverItIsCut() throws {
        let archive = try typicalCase().archive
        for pieceSize in [1, 7, archive.count] {
            XCTAssertEqual(code { _ = try self.decode(Array(archive.dropLast()), pieceSize: pieceSize) }, "XZ", "cut short")
            XCTAssertEqual(code { _ = try self.decode(archive + [0], pieceSize: pieceSize) }, "XZ", "a byte after it")
            XCTAssertEqual(code { _ = try self.decode(archive + archive, pieceSize: pieceSize) }, "XZ", "two streams")
            XCTAssertEqual(code { _ = try self.decode(Array(archive.prefix(5)), pieceSize: pieceSize) }, "XZ", "half a magic")
            XCTAssertEqual(code { _ = try self.decode([], pieceSize: pieceSize) }, "XZ", "nothing")
        }
    }

    func testTheTarReaderGivesTheSameFilesHoweverTheTarIsCut() throws {
        let typical = try typicalCase()
        let tar = try decode(typical.archive, pieceSize: typical.archive.count)
        for pieceSize in [1, 3, 511, 512, 513, 1024, tar.count] {
            var reader = TarReader()
            let events = Events()
            var position = 0
            while position < tar.count {
                let piece = Array(tar[position..<min(position + pieceSize, tar.count)])
                try piece.withUnsafeBufferPointer { try reader.read($0, handler: events) }
                position += pieceSize
            }
            try reader.finish()
            XCTAssertEqual(events.files, typical.files, "pieces of \(pieceSize)")
        }
    }

    func testATarCutAnywhereIsRefused() throws {
        let typical = try typicalCase()
        let tar = try decode(typical.archive, pieceSize: typical.archive.count)
        for length in stride(from: 0, to: tar.count, by: 97) {
            var reader = TarReader()
            let events = Events()
            let refusal = code {
                try Array(tar.prefix(length)).withUnsafeBufferPointer { try reader.read($0, handler: events) }
                try reader.finish()
            }
            // The archive ends in two zero blocks; tar pads no further in this bundle, so every
            // proper prefix lacks them.
            XCTAssertEqual(refusal, "TAR", "the first \(length) bytes")
        }
    }

    // MARK: - An archive larger than any buffer

    private func header(_ path: String, size: Int) -> [UInt8] {
        var block = [UInt8](repeating: 0, count: 512)
        let put = { (text: String, offset: Int) in block.replaceSubrange(offset..<offset + text.utf8.count, with: text.utf8) }
        let cut = path.utf8.count > 100 ? path.lastIndex(of: "/") : nil
        put(cut.map { String(path[path.index(after: $0)...]) } ?? path, 0)
        if let cut { put(String(path[..<cut]), 345) }
        put("0000644\0", 100)
        put(String(size, radix: 8).leftPadded(to: 11) + "\0", 124)
        put("0", 156)
        put("ustar\0" + "00", 257)
        let sum = block.enumerated().reduce(0) { $0 + ((148..<156).contains($1.offset) ? 0x20 : Int($1.element)) }
        put(String(sum, radix: 8).leftPadded(to: 6) + "\0 ", 148)
        return block
    }

    private func xz(_ input: [UInt8]) throws -> [UInt8] {
        let capacity = input.count + 64 * 1024
        var output = [UInt8](repeating: 0, count: capacity)
        let stream = UnsafeMutablePointer<compression_stream>.allocate(capacity: 1)
        defer { stream.deallocate() }
        XCTAssertEqual(compression_stream_init(stream, COMPRESSION_STREAM_ENCODE, COMPRESSION_LZMA), COMPRESSION_STATUS_OK)
        defer { compression_stream_destroy(stream) }
        let written: Int = input.withUnsafeBufferPointer { source in
            output.withUnsafeMutableBufferPointer { destination in
                stream.pointee.src_ptr = source.baseAddress!
                stream.pointee.src_size = source.count
                stream.pointee.dst_ptr = destination.baseAddress!
                stream.pointee.dst_size = destination.count
                XCTAssertEqual(compression_stream_process(stream, Int32(COMPRESSION_STREAM_FINALIZE.rawValue)), COMPRESSION_STATUS_END)
                return destination.count - stream.pointee.dst_size
            }
        }
        return Array(output.prefix(written))
    }

    /// Random bytes do not compress, so the archive is as long as the tar and is read in many
    /// chunks, with file data, headers and padding falling across their seams.
    func testALargeBundleUnpacksAcrossChunkSeams() throws {
        var generator = SystemRandomNumberGenerator()
        var entries: [(path: String, data: [UInt8])] = [
            ("index.html", Array("<!DOCTYPE html><html><head><title>x</title></head><body></body></html>".utf8))
        ]
        let longDirectory = String(repeating: "d", count: 120)
        for index in 0..<40 {
            let size = [0, 1, 511, 512, 513, 65_535, 65_536, 65_537, 100_003][index % 9]
            let data = (0..<size).map { _ in UInt8.random(in: 0...255, using: &generator) }
            entries.append((index % 2 == 0 ? "_next/static/chunks/\(index).js" : "\(longDirectory)/\(index).bin", data))
        }
        var tar: [UInt8] = []
        for entry in entries {
            tar += header(entry.path, size: entry.data.count) + entry.data
            tar += [UInt8](repeating: 0, count: (512 - entry.data.count % 512) % 512)
        }
        tar += [UInt8](repeating: 0, count: 1024)
        let archive = try xz(tar)
        XCTAssertGreaterThan(archive.count, 8 * OtaBundle.chunkSize)

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ota-core-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = directory.appendingPathComponent("bundle.tar.xz")
        try Data(archive).write(to: file)

        let sink = RecordingSink()
        try OtaBundle.unpack(fileAt: file, size: Int64(archive.count), sha256: hex(SHA256.hash(data: archive)), into: sink)
        XCTAssertEqual(sink.files, entries.map {
            RecordingSink.File(path: $0.path, size: Int64($0.data.count), sha256: hex(SHA256.hash(data: $0.data)))
        })

        XCTAssertEqual(code {
            try OtaBundle.unpack(fileAt: file, size: Int64(archive.count) + 1, sha256: hex(SHA256.hash(data: archive)), into: RecordingSink())
        }, "SIZE")
        XCTAssertEqual(code {
            try OtaBundle.unpack(fileAt: file, size: Int64(archive.count), sha256: String(repeating: "0", count: 64), into: RecordingSink())
        }, "SHA256")
    }

    func testNothingReachesTheSinkBeforeSizeAndHashMatch() throws {
        let typical = try typicalCase()
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ota-core-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = directory.appendingPathComponent("bundle.tar.xz")
        try Data(typical.archive).write(to: file)
        let sink = RecordingSink()
        XCTAssertEqual(code {
            try OtaBundle.unpack(fileAt: file, size: Int64(typical.archive.count), sha256: String(repeating: "0", count: 64), into: sink)
        }, "SHA256")
        XCTAssertEqual(sink.files, [])
    }

    func testAFailingSinkStopsTheUnpackWithItsOwnError() throws {
        final class FullDisk: OtaBundleSink {
            struct Failure: Error {}
            var began = 0
            func beginFile(path: String, size: Int64) throws { began += 1 }
            func write(_ bytes: UnsafeRawBufferPointer) throws { throw Failure() }
            func endFile() throws {}
        }
        let testCase = try XCTUnwrap(try Fixtures.cases("bundle-cases.json").first { $0.caseName == "a typical bundle" })
        let file = Fixtures.directory.appendingPathComponent(try XCTUnwrap(testCase["bundle"]?.text))
        let sink = FullDisk()
        XCTAssertThrowsError(
            try OtaBundle.unpack(fileAt: file, size: try XCTUnwrap(testCase["size"]?.integer), sha256: try XCTUnwrap(testCase["sha256"]?.text), into: sink)
        ) { error in
            XCTAssertTrue(error is FullDisk.Failure, "\(error)")
        }
        XCTAssertEqual(sink.began, 1)
    }

    func testNoFileReachesTheSinkAfterTheFirstEntryFault() throws {
        // index.html, then a symbolic link, then a regular file the checker must no longer hand over.
        var tar = header("index.html", size: 13) + Array("<head></head>".utf8) + [UInt8](repeating: 0, count: 512 - 13)
        var link = header("link", size: 0)
        link[156] = UInt8(ascii: "2")
        let sum = link.enumerated().reduce(0) { $0 + ((148..<156).contains($1.offset) ? 0x20 : Int($1.element)) }
        link.replaceSubrange(148..<156, with: (String(sum, radix: 8).leftPadded(to: 6) + "\0 ").utf8)
        tar += link
        tar += header("after.js", size: 1) + [0x61] + [UInt8](repeating: 0, count: 511)
        tar += [UInt8](repeating: 0, count: 1024)
        let archive = try xz(tar)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ota-core-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = directory.appendingPathComponent("bundle.tar.xz")
        try Data(archive).write(to: file)
        let sink = RecordingSink()
        XCTAssertEqual(code {
            try OtaBundle.unpack(fileAt: file, size: Int64(archive.count), sha256: hex(SHA256.hash(data: archive)), into: sink)
        }, "ENTRY_TYPE")
        XCTAssertEqual(sink.files.map(\.path), ["index.html"])
    }
}

private extension String {
    func leftPadded(to length: Int) -> String {
        String(repeating: "0", count: max(0, length - count)) + self
    }
}
