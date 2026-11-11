import Foundation
import XCTest
@testable import OtaCore

/// Every case of `apps/mobile/ota/fixtures`, by outcome: what is accepted, or the code of the
/// first check that refuses it. Never a message.
final class SharedCasesTests: XCTestCase {
    func testKeyIds() throws {
        let keys = try Fixtures.keys()
        XCTAssertEqual(keys.count, 3)
        for (name, entry) in keys {
            XCTAssertEqual(entry.key.id, entry.keyId, "key \(name)")
        }
    }

    func testManifestCases() throws {
        let keys = try Fixtures.keys()
        for testCase in try Fixtures.cases("manifest-cases.json") {
            let name = testCase.caseName
            let held = try XCTUnwrap(testCase["keys"]?.items, name).map { try XCTUnwrap(keys[try XCTUnwrap($0.text)], name).key }
            let manifest = try XCTUnwrap(testCase["manifest"]?.stringBytes, name)
            var payload: OtaPayload?
            let refusal = code { payload = try OtaManifest.verify(manifest, keys: held) }
            XCTAssertEqual(refusal, testCase.expectedError, name)
            guard let expected = testCase["expect"]?["payload"] else {
                XCTAssertNotNil(testCase.expectedError, "\(name): a case expects a payload or an error")
                continue
            }
            XCTAssertEqual(expected["format"]?.integer, 1, name)
            XCTAssertEqual(payload?.version.description, try XCTUnwrap(expected["version"]?.text), name)
            XCTAssertEqual(payload?.bridgeLevel, try XCTUnwrap(expected["bridgeLevel"]?.integer), name)
            XCTAssertEqual(payload?.url, try XCTUnwrap(expected["url"]?.text), name)
            XCTAssertEqual(payload?.size, try XCTUnwrap(expected["size"]?.integer), name)
            XCTAssertEqual(payload?.sha256, try XCTUnwrap(expected["sha256"]?.text), name)
        }
    }

    func testBundleCases() throws {
        for testCase in try Fixtures.cases("bundle-cases.json") {
            let name = testCase.caseName
            let file = Fixtures.directory.appendingPathComponent(try XCTUnwrap(testCase["bundle"]?.text, name))
            let size = try XCTUnwrap(testCase["size"]?.integer, name)
            let sha256 = try XCTUnwrap(testCase["sha256"]?.text, name)
            let sink = RecordingSink()
            let refusal = code { try OtaBundle.unpack(fileAt: file, size: size, sha256: sha256, into: sink) }
            XCTAssertEqual(refusal, testCase.expectedError, name)
            guard let expected = testCase["expect"]?["files"]?.items else {
                XCTAssertNotNil(testCase.expectedError, "\(name): a case expects files or an error")
                continue
            }
            let files = try expected.map { entry in
                RecordingSink.File(
                    path: try XCTUnwrap(entry["path"]?.text, name),
                    size: try XCTUnwrap(entry["size"]?.integer, name),
                    sha256: try XCTUnwrap(entry["sha256"]?.text, name)
                )
            }
            XCTAssertEqual(sink.files, files, name)
        }
    }

    func testEnvCases() throws {
        for testCase in try Fixtures.cases("env-cases.json") {
            let name = testCase.caseName
            let builtin = try XCTUnwrap(testCase["builtin"]?.stringBytes, name)
            let staged = try XCTUnwrap(testCase["staged"]?.stringBytes, name)
            var html: [UInt8]?
            let refusal = code { html = try OtaEnv.copy(builtin: builtin, staged: staged) }
            XCTAssertEqual(refusal, testCase.expectedError, name)
            guard let expected = testCase["expect"]?["html"]?.stringBytes else {
                XCTAssertNotNil(testCase.expectedError, "\(name): a case expects html or an error")
                continue
            }
            XCTAssertEqual(html, expected, name)
        }
    }

    func testDecisionCases() throws {
        for testCase in try Fixtures.cases("decision-cases.json") {
            let name = testCase.caseName
            let shell = try XCTUnwrap(testCase["shell"], name)
            let bundles = try XCTUnwrap(testCase["bundles"], name)
            let payload = try XCTUnwrap(testCase["payload"], name)
            let version = { (value: JSONValue?) in try XCTUnwrap(value?.text.flatMap(OtaVersion.init), name) }
            let optionalVersion = { (value: JSONValue?) in try XCTUnwrap(value, name) == .null ? nil : try version(value) }
            let state = OtaState(
                active: try optionalVersion(bundles["active"]),
                pending: try optionalVersion(bundles["pending"]).map { .init(version: $0, attempts: 0) },
                bad: try XCTUnwrap(bundles["bad"]?.items, name).map(version)
            )
            let decision = OtaRules.decide(
                builtin: try version(shell["builtinVersion"]),
                bridgeLevel: try XCTUnwrap(shell["bridgeLevel"]?.integer, name),
                state: state,
                version: try version(payload["version"]),
                requiredBridgeLevel: try XCTUnwrap(payload["bridgeLevel"]?.integer, name)
            )
            XCTAssertEqual(decision.rawValue, try XCTUnwrap(testCase["expect"]?.text, name), name)
        }
    }

    /// The keys this binary would compile in must be ones the shell can load.
    func testCommittedKeysLoad() throws {
        let bytes = Array(try Data(contentsOf: Fixtures.mobile.appendingPathComponent("ota/keys.json")))
        let keys = try OtaKey.keys(fromKeysJSON: bytes)
        XCTAssertEqual(keys.count, 2)
        for key in keys {
            XCTAssertEqual(key.id.count, 16)
        }
    }
}
