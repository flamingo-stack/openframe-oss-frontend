import CryptoKit
import Foundation
import XCTest
@testable import OtaCore

/// The shared cases of `apps/mobile/ota/fixtures`, which the release scripts and the Android
/// shell run too (docs/ota.md, "Shared test cases"). Read from the repository, not copied.
enum Fixtures {
    static let mobile = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
    static let directory = mobile.appendingPathComponent("ota/fixtures")

    /// Parsed by the strict parser, byte for byte: `JSONSerialization` drops a byte order mark at
    /// the start of a string, which one manifest case is about.
    static func json(_ name: String) throws -> JSONValue {
        let data = try Data(contentsOf: directory.appendingPathComponent(name))
        return try XCTUnwrap(StrictJSON.parse(Array(data)), name)
    }

    /// An empty list fails: a renamed key must not pass as "no cases".
    static func cases(_ name: String) throws -> [JSONValue] {
        let cases = try XCTUnwrap(try json(name)["cases"]?.items, name)
        XCTAssertFalse(cases.isEmpty, name)
        return cases
    }

    static func keys() throws -> [String: (keyId: String, key: OtaKey)] {
        guard case .object(let entries)? = try json("fixture-keys.json")["keys"] else {
            XCTFail("fixture-keys.json has no keys")
            return [:]
        }
        var keys: [String: (keyId: String, key: OtaKey)] = [:]
        for (name, entry) in entries {
            keys[String(decoding: name, as: UTF8.self)] = (
                try XCTUnwrap(entry["keyId"]?.text),
                try OtaKey(pem: try XCTUnwrap(entry["publicKey"]?.text))
            )
        }
        return keys
    }
}

extension JSONValue {
    var text: String? { stringBytes.map { String(decoding: $0, as: UTF8.self) } }

    var items: [JSONValue]? {
        guard case .array(let items) = self else { return nil }
        return items
    }

    var caseName: String { self["name"]?.text ?? "(unnamed case)" }

    var expectedError: String? { self["expect"]?["error"]?.text }
}

func code(of body: () throws -> Void) -> String? {
    do {
        try body()
        return nil
    } catch let error as OtaError {
        return error.code.rawValue
    } catch {
        return "not an OtaError: \(error)"
    }
}

func hex(_ digest: some Sequence<UInt8>) -> String {
    digest.map { String(format: "%02x", $0) }.joined()
}

final class RecordingSink: OtaBundleSink {
    struct File: Equatable {
        let path: String
        let size: Int64
        let sha256: String
    }

    private(set) var files: [File] = []
    private var current: (path: String, size: Int64, written: Int64, hasher: SHA256)?

    func beginFile(path: String, size: Int64) throws {
        XCTAssertNil(current, "a file began before the last one ended")
        current = (path, size, 0, SHA256())
    }

    func write(_ bytes: UnsafeRawBufferPointer) throws {
        XCTAssertNotNil(current, "bytes outside a file")
        current?.hasher.update(bufferPointer: bytes)
        current?.written += Int64(bytes.count)
    }

    func endFile() throws {
        let file = try XCTUnwrap(current)
        XCTAssertEqual(file.written, file.size, file.path)
        files.append(File(path: file.path, size: file.size, sha256: hex(file.hasher.finalize())))
        current = nil
    }
}
