import CryptoKit
import Foundation
import XCTest
@testable import OtaCore

private func parse(_ text: String) -> JSONValue? { StrictJSON.parse(Array(text.utf8)) }

final class StrictJSONTests: XCTestCase {
    func testValuesKeepTheirJSONTypes() {
        XCTAssertEqual(parse("true"), .bool(true))
        XCTAssertEqual(parse("1"), .number([UInt8(ascii: "1")]))
        XCTAssertNil(parse("true")?.integer)
        XCTAssertNil(parse("\"1\"")?.integer)
        XCTAssertEqual(parse(" {\"a\" : [1, null, false, \"x\"]} \n"), .object([Array("a".utf8): .array([
            .number(Array("1".utf8)), .null, .bool(false), .string(Array("x".utf8))
        ])]))
    }

    func testIntegers() {
        XCTAssertEqual(parse("0")?.integer, 0)
        XCTAssertEqual(parse("-0")?.integer, 0)
        XCTAssertEqual(parse("4482516")?.integer, 4_482_516)
        XCTAssertEqual(parse("-17")?.integer, -17)
        XCTAssertEqual(parse("9223372036854775807")?.integer, Int64.max)
        XCTAssertEqual(parse("-9223372036854775808")?.integer, Int64.min)
        XCTAssertNil(parse("9223372036854775808")?.integer)
        for spelledOtherwise in ["1.0", "1e0", "1E2", "1.5", "-1.0"] {
            XCTAssertNotNil(parse(spelledOtherwise), spelledOtherwise)
            XCTAssertNil(parse(spelledOtherwise)?.integer, spelledOtherwise)
        }
    }

    func testWhatIsNotJSON() {
        let refused = [
            "", " ", "{", "}", "[1,]", "{\"a\":1,}", "{a:1}", "{'a':1}", "'a'", "01", "+1", "1.", ".5", "1e", "-", "0x10",
            "NaN", "Infinity", "True", "nul", "\"a", "\"a\nb\"", "\"\\x\"", "\"\\u12\"", "\"\\ud800\"", "\"\\udc00\"",
            "\"\\ud800\\u0041\"", "// c\n1", "/* c */ 1", "1 2", "{} {}", "[1 2]", "{\"a\" 1}", "{\"a\":}", "\u{FEFF}1"
        ]
        for text in refused {
            XCTAssertNil(parse(text), text)
        }
    }

    func testStringsDecodeToBytes() {
        XCTAssertEqual(parse("\"a\\n\\t\\\"\\\\\\/\\b\\f\\r\"")?.stringBytes, [0x61, 0x0A, 0x09, 0x22, 0x5C, 0x2F, 0x08, 0x0C, 0x0D])
        XCTAssertEqual(parse("\"\\u00e9\"")?.stringBytes, [0xC3, 0xA9])
        XCTAssertEqual(parse("\"\\uD83D\\uDE00\"")?.stringBytes, [0xF0, 0x9F, 0x98, 0x80])
        XCTAssertEqual(parse("\"é\"")?.stringBytes, [0xC3, 0xA9])
        XCTAssertEqual(parse("\"\\u0000\"")?.stringBytes, [0x00])
    }

    func testKeysAreBytesNotCanonicallyEquivalentText() {
        // U+212A KELVIN SIGN is canonically equivalent to "K": equal as Swift strings, other bytes.
        let object = parse("{\"\\u212A\":1,\"K\":2}")
        XCTAssertEqual(object?["K"]?.integer, 2)
        XCTAssertEqual(object?["\u{212A}"]?.integer, 1)
    }

    func testAKeyGivenTwiceKeepsItsLastValue() {
        XCTAssertEqual(parse("{\"a\":1,\"a\":2}")?["a"]?.integer, 2)
    }

    func testInvalidUTF8IsRefused() {
        let quote = UInt8(ascii: "\"")
        for bytes: [UInt8] in [[0xFF], [0xC3], [0xC0, 0xAF], [0xED, 0xA0, 0x80], [0xF4, 0x90, 0x80, 0x80], [0x80]] {
            XCTAssertNil(StrictJSON.parse([quote] + bytes + [quote]), "\(bytes)")
        }
        XCTAssertNotNil(StrictJSON.parse([quote, 0xF4, 0x8F, 0xBF, 0xBF, quote]))
    }

    func testNestingIsBounded() {
        let arrays = { (depth: Int) in String(repeating: "[", count: depth) + String(repeating: "]", count: depth) }
        let objects = { (depth: Int) in String(repeating: "{\"a\":", count: depth) + "1" + String(repeating: "}", count: depth) }
        // The bound is the Android shell's too (Json.MAX_DEPTH), so it is spelled out here.
        XCTAssertEqual(StrictJSON.maxDepth, 32)
        XCTAssertNotNil(parse(arrays(32)))
        XCTAssertNil(parse(arrays(33)))
        XCTAssertNotNil(parse(objects(32)))
        XCTAssertNil(parse(objects(33)))
        XCTAssertNotNil(parse(String(repeating: "[{\"a\":", count: 16) + "1" + String(repeating: "}]", count: 16)))
        XCTAssertNil(parse(String(repeating: "[{\"a\":", count: 16) + "[]" + String(repeating: "}]", count: 16)))
        // Deep enough to overflow the stack of a parser that recursed without a bound.
        XCTAssertNil(parse(String(repeating: "[", count: 1_000_000)))
        XCTAssertNil(parse(String(repeating: "{\"a\":", count: 200_000)))
    }

    func testADeeplyNestedManifestIsRefusedAsAnEnvelope() {
        let manifest = "{\"keyId\":\"x\",\"payload\":\"\",\"signature\":\"\",\"x\":" + String(repeating: "[", count: 100_000) + "}"
        XCTAssertEqual(code { _ = try OtaManifest.verify(Array(manifest.utf8), keys: []) }, "ENVELOPE")
    }
}

final class EncodingTests: XCTestCase {
    private func decode(_ text: String) -> [UInt8]? { CanonicalBase64.decode(Array(text.utf8)) }

    func testCanonicalBase64() {
        XCTAssertEqual(decode(""), [])
        XCTAssertEqual(decode("AA=="), [0])
        XCTAssertEqual(decode("AAA="), [0, 0])
        XCTAssertEqual(decode("AAAA"), [0, 0, 0])
        XCTAssertEqual(decode("+/+/"), [0xFB, 0xFF, 0xBF])
        XCTAssertEqual(decode("aGVsbG8="), Array("hello".utf8))
        for text in ["A", "AA", "AAA", "AA=", "AB==", "AAB=", "-_-_", "AA==AAAA", "AAAA\n", " AAAA", "A=AA", "=AAA", "AAA=AAAA", "====", "A===", "AAAA===="] {
            XCTAssertNil(decode(text), text)
        }
    }

    func testEveryByteSurvivesBase64() {
        let bytes = (0..<1024).map { UInt8(truncatingIfNeeded: $0 &* 31 &+ $0 / 7) }
        for length in [0, 1, 2, 3, 4, 255, 1024] {
            let slice = Array(bytes.prefix(length))
            XCTAssertEqual(CanonicalBase64.decode(Array(Data(slice).base64EncodedData())), slice)
        }
    }

    private func der(r: [UInt8], s: [UInt8]) -> [UInt8] {
        let body = [0x02, UInt8(r.count)] + r + [0x02, UInt8(s.count)] + s
        return [0x30, UInt8(body.count)] + body
    }

    func testStrictDERSignatures() {
        let low = [UInt8](repeating: 0x11, count: 32)
        let high = [0x00] + [UInt8](repeating: 0x81, count: 32)
        XCTAssertTrue(StrictDER.isECDSASignature(der(r: low, s: low)))
        XCTAssertTrue(StrictDER.isECDSASignature(der(r: high, s: high)))
        XCTAssertTrue(StrictDER.isECDSASignature(der(r: [0x01], s: [0x7F])))

        XCTAssertFalse(StrictDER.isECDSASignature([]))
        XCTAssertFalse(StrictDER.isECDSASignature(low + low), "raw r‖s")
        XCTAssertFalse(StrictDER.isECDSASignature(der(r: [0x00] + low, s: low)), "a needless leading zero")
        XCTAssertFalse(StrictDER.isECDSASignature(der(r: [UInt8](repeating: 0x81, count: 32), s: low)), "a negative integer")
        XCTAssertFalse(StrictDER.isECDSASignature(der(r: low, s: [0x00])), "zero")
        XCTAssertFalse(StrictDER.isECDSASignature(der(r: low, s: [])), "an empty integer")
        XCTAssertFalse(StrictDER.isECDSASignature(der(r: low, s: low) + [0x00]), "a trailing byte")
        XCTAssertFalse(StrictDER.isECDSASignature(der(r: [0x01] + low, s: low)), "33 bytes without a sign byte")
        let body = Array(der(r: low, s: low).dropFirst(2))
        XCTAssertFalse(StrictDER.isECDSASignature([0x30, 0x81, UInt8(body.count)] + body), "a long-form length")
        XCTAssertFalse(StrictDER.isECDSASignature([0x30, UInt8(body.count + 1)] + body), "a length past the end")
        XCTAssertFalse(StrictDER.isECDSASignature([0x31, UInt8(body.count)] + body), "not a sequence")
        XCTAssertFalse(StrictDER.isECDSASignature([0x30, 34, 0x02, 32] + low), "one integer")
        var third = der(r: low, s: low)
        third[1] += 3
        XCTAssertFalse(StrictDER.isECDSASignature(third + [0x02, 0x01, 0x01]), "three integers")
    }

    func testAKeyIsOnlyThe91ByteNamedCurveEncoding() throws {
        let key = P256.Signing.PrivateKey().publicKey
        let spki = Array(key.derRepresentation)
        XCTAssertEqual(spki.count, 91)
        let loaded = try OtaKey(spkiDER: spki)
        XCTAssertEqual(loaded.id, hex(SHA256.hash(data: spki).prefix(8)))
        XCTAssertEqual(try OtaKey(pem: key.pemRepresentation).id, loaded.id)

        XCTAssertEqual(code { _ = try OtaKey(spkiDER: Array(spki.dropLast())) }, "KEYS")
        XCTAssertEqual(code { _ = try OtaKey(spkiDER: spki + [0]) }, "KEYS")
        var offCurve = spki
        offCurve[90] ^= 1
        XCTAssertEqual(code { _ = try OtaKey(spkiDER: offCurve) }, "KEYS")
        XCTAssertEqual(code { _ = try OtaKey(pem: P256.Signing.PrivateKey().pemRepresentation) }, "KEYS")
        XCTAssertEqual(code { _ = try OtaKey(pem: "not a PEM") }, "KEYS")
    }

    func testKeysJSON() throws {
        let current = P256.Signing.PrivateKey().publicKey.pemRepresentation
        let next = P256.Signing.PrivateKey().publicKey.pemRepresentation
        let file = { (members: [String: String]) -> [UInt8] in
            Array(try! JSONSerialization.data(withJSONObject: members))
        }
        XCTAssertEqual(try OtaKey.keys(fromKeysJSON: file(["current": current, "next": next])).count, 2)
        XCTAssertEqual(try OtaKey.keys(fromKeysJSON: file(["current": current])).count, 1)
        XCTAssertEqual(try OtaKey.keys(fromKeysJSON: file(["current": current, "next": current])).count, 1)
        XCTAssertEqual(code { _ = try OtaKey.keys(fromKeysJSON: file([:])) }, "KEYS")
        XCTAssertEqual(code { _ = try OtaKey.keys(fromKeysJSON: file(["current": current, "next": "nonsense"])) }, "KEYS")
        XCTAssertEqual(code { _ = try OtaKey.keys(fromKeysJSON: Array("[]".utf8)) }, "KEYS")
        XCTAssertEqual(code { _ = try OtaKey.keys(fromKeysJSON: Array("{\"current\":1}".utf8)) }, "KEYS")
    }

    func testASignedManifestVerifiesEndToEnd() throws {
        let signer = P256.Signing.PrivateKey()
        let key = try OtaKey(spkiDER: Array(signer.publicKey.derRepresentation))
        let payload = Data("{\"format\":1,\"version\":\"1.2.3\",\"bridgeLevel\":1,\"url\":\"https://h/openframe-mobile-1.2.3.tar.xz\",\"size\":7,\"sha256\":\"\(String(repeating: "a", count: 64))\"}".utf8)
        let manifest = { (signature: Data) in
            Array("{\"keyId\":\"\(key.id)\",\"payload\":\"\(payload.base64EncodedString())\",\"signature\":\"\(signature.base64EncodedString())\"}".utf8)
        }
        let signature = try signer.signature(for: payload)
        XCTAssertEqual(try OtaManifest.verify(manifest(signature.derRepresentation), keys: [key]).version, OtaVersion("1.2.3"))
        XCTAssertEqual(code { _ = try OtaManifest.verify(manifest(signature.rawRepresentation), keys: [key]) }, "SIGNATURE")
        XCTAssertEqual(code { _ = try OtaManifest.verify(manifest(signature.derRepresentation), keys: []) }, "UNKNOWN_KEY")
    }
}

final class ErrorTests: XCTestCase {
    /// A refusal for what a signed bundle holds marks its version bad; one a cut or swapped
    /// download gives, or one about the manifest, the keys or the built-in page, never does.
    func testOnlyAContentRefusalMarksABundleBad() {
        let content: Set<OtaCode> = [.xz, .tar, .entryType, .entryName, .duplicate, .noIndex, .hasEnv, .noHead]
        for code in OtaCode.allCases {
            XCTAssertEqual(OtaError(code, "").isContentRefusal, content.contains(code), code.rawValue)
        }
    }

    func testTheCodesAreTheSharedOnes() {
        XCTAssertEqual(OtaCode.allCases.map(\.rawValue), [
            "ENVELOPE", "UNKNOWN_KEY", "SIGNATURE", "PAYLOAD", "SIZE", "SHA256", "XZ", "TAR", "ENTRY_TYPE", "ENTRY_NAME",
            "DUPLICATE", "NO_INDEX", "NO_ENV", "HAS_ENV", "NO_HEAD", "KEYS"
        ])
    }
}

final class EnvTests: XCTestCase {
    func testTheScannerFindsALiteralAcrossPieces() {
        let literal = Array("<script>window.__ENV".utf8)
        let page = Array("<html><head></head><body><script>window.__ENV = {};</script></body></html>".utf8)
        for pieceSize in 1...page.count {
            var scanner = LiteralScanner(literal)
            var position = 0
            while position < page.count {
                let piece = Array(page[position..<min(position + pieceSize, page.count)])
                piece.withUnsafeBufferPointer { scanner.scan($0) }
                position += pieceSize
            }
            XCTAssertTrue(scanner.found, "pieces of \(pieceSize)")
        }
        var scanner = LiteralScanner(literal)
        Array("<script>window.__EN".utf8).withUnsafeBufferPointer { scanner.scan($0) }
        Array("<script>window._ENV".utf8).withUnsafeBufferPointer { scanner.scan($0) }
        XCTAssertFalse(scanner.found)
    }

    func testMatchingIsOnBytes() throws {
        // For a String the ">" of this "<head>" and the combining mark after it are one
        // character, so a String search does not find the tag. The bytes are there.
        let text = "<html><head>\u{0301}</head></html>"
        XCTAssertFalse(text.contains("<head>"))
        let staged = Array(text.utf8)
        let element = Array("<script>window.__ENV = {};</script>".utf8)
        let page = try OtaEnv.insert(element: element, into: staged)
        XCTAssertEqual(page, Array("<html><head>".utf8) + element + Array("\u{0301}</head></html>".utf8))
    }

    func testAPageCarriesOnlyTheElementItWasUnpackedWith() throws {
        let element = Array("<script>window.__ENV = {\"HOST\":\"https://a.example\"};</script>".utf8)
        let staged = Array("<html><head><title>t</title></head><body></body></html>".utf8)
        let page = try OtaEnv.insert(element: element, into: staged)
        XCTAssertTrue(OtaEnv.page(page, carries: element))
        XCTAssertEqual(try OtaEnv.element(inBuiltin: page), element)

        // What a store update built for another lane would look for in it.
        for other in [
            "<script>window.__ENV = {\"HOST\":\"https://b.example\"};</script>",
            "<script>window.__ENV = {\"HOST\":\"https://a.example\",\"MODE\":\"x\"};</script>",
            "<script>window.__ENV = {\"HOST\":\"https://a.exampl\"};</script>",
            "<script>window.__ENV = {\"HOST\":\"https://a.example\"}; </script>"
        ] {
            XCTAssertFalse(OtaEnv.page(page, carries: Array(other.utf8)), other)
        }
        XCTAssertFalse(OtaEnv.page(staged, carries: element))
        XCTAssertFalse(OtaEnv.page([], carries: element))
    }

    func testCarryingIsMatchedOnBytes() throws {
        // Canonically equivalent for a String, different bytes: not the same element.
        let composed = Array("<script>window.__ENV = {\"N\":\"\u{00E9}\"};</script>".utf8)
        let decomposed = Array("<script>window.__ENV = {\"N\":\"e\u{0301}\"};</script>".utf8)
        let page = try OtaEnv.insert(element: composed, into: Array("<html><head></head></html>".utf8))
        XCTAssertTrue(OtaEnv.page(page, carries: composed))
        XCTAssertFalse(OtaEnv.page(page, carries: decomposed))
    }

    func testByteSearch() {
        let bytes = Array("abcabc".utf8)
        XCTAssertEqual(bytes.offset(of: Array("abc".utf8)), 0)
        XCTAssertEqual(bytes.offset(of: Array("abc".utf8), from: 1), 3)
        XCTAssertEqual(bytes.offset(of: Array("c".utf8), from: 5), 5)
        XCTAssertNil(bytes.offset(of: Array("abc".utf8), from: 4))
        XCTAssertNil(bytes.offset(of: Array("abcabca".utf8)))
        XCTAssertNil(bytes.offset(of: []))
        XCTAssertNil([UInt8]().offset(of: Array("a".utf8)))
    }
}
