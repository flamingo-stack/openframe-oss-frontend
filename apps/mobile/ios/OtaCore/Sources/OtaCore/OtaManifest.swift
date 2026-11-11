import CryptoKit
import Foundation

public struct OtaKey {
    public let id: String
    let key: P256.Signing.PublicKey

    // The one SPKI encoding of a P-256 key every implementation hashes alike (91 bytes):
    // id-ecPublicKey with the named curve prime256v1, then an uncompressed point.
    private static let spkiPrefix: [UInt8] = [
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01,
        0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00
    ]
    private static let pointLength = 65

    public init(spkiDER der: [UInt8]) throws {
        guard der.count == Self.spkiPrefix.count + Self.pointLength, der.starts(with: Self.spkiPrefix),
              let key = try? P256.Signing.PublicKey(x963Representation: der[Self.spkiPrefix.count...])
        else {
            throw OtaError(.keys, "not a P-256 public key in the named-curve, uncompressed SPKI encoding")
        }
        self.key = key
        self.id = SHA256.hash(data: der).prefix(8).map { String(format: "%02x", $0) }.joined()
    }

    public init(pem: String) throws {
        let lines = pem.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }
        guard lines.count >= 3, lines.first == "-----BEGIN PUBLIC KEY-----", lines.last == "-----END PUBLIC KEY-----",
              let der = Data(base64Encoded: lines[1..<lines.count - 1].joined())
        else {
            throw OtaError(.keys, "not a PEM public key")
        }
        try self.init(spkiDER: Array(der))
    }

    /// The keys of `apps/mobile/ota/keys.json`: `current`, and `next` unless a rotation has just
    /// used it up.
    public static func keys(fromKeysJSON bytes: [UInt8]) throws -> [OtaKey] {
        guard let json = StrictJSON.parse(bytes), case .object = json else {
            throw OtaError(.keys, "keys.json is not a JSON object")
        }
        var keys: [OtaKey] = []
        for slot in ["current", "next"] {
            guard let value = json[slot] else { continue }
            guard let pem = value.stringBytes else { throw OtaError(.keys, "keys.json \"\(slot)\" is not a string") }
            let key = try OtaKey(pem: String(decoding: pem, as: UTF8.self))
            if !keys.contains(where: { $0.id == key.id }) { keys.append(key) }
        }
        guard !keys.isEmpty else { throw OtaError(.keys, "keys.json holds no key") }
        return keys
    }
}

public struct OtaPayload: Equatable, Sendable {
    public let version: OtaVersion
    public let bridgeLevel: Int64
    public let url: String
    public let size: Int64
    public let sha256: String
}

public enum OtaManifest {
    public static let format: Int64 = 1
    /// More than a manifest ever is: a shell reads at most this much of one.
    public static let maxBytes = 64 * 1024

    /// The checks run in the order docs/ota.md gives: ENVELOPE, UNKNOWN_KEY, SIGNATURE, PAYLOAD.
    public static func verify(_ manifest: [UInt8], keys: [OtaKey]) throws -> OtaPayload {
        guard let envelope = StrictJSON.parse(manifest), case .object = envelope else {
            throw OtaError(.envelope, "the manifest is not a JSON object")
        }
        guard let keyId = envelope["keyId"]?.stringBytes,
              let payloadText = envelope["payload"]?.stringBytes,
              let signatureText = envelope["signature"]?.stringBytes
        else {
            throw OtaError(.envelope, "the manifest has no keyId, payload or signature string")
        }
        guard let payloadBytes = CanonicalBase64.decode(payloadText),
              let signatureBytes = CanonicalBase64.decode(signatureText)
        else {
            throw OtaError(.envelope, "payload or signature is not canonical base64")
        }
        guard let key = keys.first(where: { $0.id.utf8.elementsEqual(keyId) }) else {
            throw OtaError(.unknownKey, "the manifest is signed by a key this shell does not hold")
        }
        guard StrictDER.isECDSASignature(signatureBytes),
              let signature = try? P256.Signing.ECDSASignature(derRepresentation: signatureBytes),
              key.key.isValidSignature(signature, for: Data(payloadBytes))
        else {
            throw OtaError(.signature, "the signature does not verify with key \(key.id)")
        }
        return try payload(payloadBytes)
    }

    private static func payload(_ bytes: [UInt8]) throws -> OtaPayload {
        guard let json = StrictJSON.parse(bytes), case .object = json else {
            throw OtaError(.payload, "the payload is not a JSON object")
        }
        guard json["format"]?.integer == format else {
            throw OtaError(.payload, "payload format")
        }
        guard let versionBytes = json["version"]?.stringBytes, let version = OtaVersion(utf8: versionBytes) else {
            throw OtaError(.payload, "payload version is not x.y.z")
        }
        guard let bridgeLevel = json["bridgeLevel"]?.integer, bridgeLevel >= 1 else {
            throw OtaError(.payload, "payload bridgeLevel")
        }
        guard let size = json["size"]?.integer, size >= 1 else {
            throw OtaError(.payload, "payload size")
        }
        guard let sha256 = json["sha256"]?.stringBytes, sha256.count == 64, sha256.allSatisfy(isLowerHex) else {
            throw OtaError(.payload, "payload sha256")
        }
        // Compared as bytes, never parsed: no query or fragment can carry the file name instead.
        let fileName = Array("/openframe-mobile-\(version).tar.xz".utf8)
        guard let url = json["url"]?.stringBytes,
              url.starts(with: Array("https://".utf8)),
              !url.contains(UInt8(ascii: "?")), !url.contains(UInt8(ascii: "#")),
              url.count >= fileName.count, url.suffix(fileName.count).elementsEqual(fileName)
        else {
            throw OtaError(.payload, "payload url does not name the bundle of \(version)")
        }
        return OtaPayload(
            version: version,
            bridgeLevel: bridgeLevel,
            url: String(decoding: url, as: UTF8.self),
            size: size,
            sha256: String(decoding: sha256, as: UTF8.self)
        )
    }

    private static func isLowerHex(_ byte: UInt8) -> Bool {
        (byte >= UInt8(ascii: "0") && byte <= UInt8(ascii: "9")) || (byte >= UInt8(ascii: "a") && byte <= UInt8(ascii: "f"))
    }
}

enum CanonicalBase64 {
    private static let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".utf8)
    private static let pad = UInt8(ascii: "=")

    /// nil unless `text` is the one canonical spelling of its bytes: the standard alphabet,
    /// padded, no line breaks, zero padding bits.
    static func decode(_ text: [UInt8]) -> [UInt8]? {
        guard text.count % 4 == 0 else { return nil }
        var out: [UInt8] = []
        out.reserveCapacity(text.count / 4 * 3)
        var index = 0
        while index < text.count {
            let quad = text[index..<index + 4]
            index += 4
            let padding = quad.reversed().prefix(while: { $0 == pad }).count
            guard padding <= 2, padding == 0 || index == text.count else { return nil }
            var group: UInt32 = 0
            for byte in quad.dropLast(padding) {
                guard let value = alphabet.firstIndex(of: byte) else { return nil }
                group = group << 6 | UInt32(value)
            }
            group <<= UInt32(6 * padding)
            out.append(UInt8(truncatingIfNeeded: group >> 16))
            if padding < 2 { out.append(UInt8(truncatingIfNeeded: group >> 8)) }
            if padding < 1 { out.append(UInt8(truncatingIfNeeded: group)) }
        }
        return Data(out).base64EncodedData().elementsEqual(text) ? out : nil
    }
}

enum StrictDER {
    /// docs/ota.md names the forms that must be refused: a needless leading zero, a negative
    /// integer, a long-form length, a trailing byte, raw r‖s. CryptoKit refuses them all on the
    /// SDK the shared cases run on, but how strictly it reads DER is not part of its contract and
    /// the app runs from iOS 16.4 up, so the rule is held here, not left to it.
    /// A P-256 signature is at most 70 bytes of content, so every length is short-form.
    static func isECDSASignature(_ der: [UInt8]) -> Bool {
        guard der.count >= 2, der[0] == 0x30, der[1] < 0x80, Int(der[1]) == der.count - 2 else { return false }
        var position = 2
        for _ in 0..<2 {
            guard position + 2 <= der.count, der[position] == 0x02 else { return false }
            let length = Int(der[position + 1])
            let start = position + 2
            guard length >= 1, length <= 33, start + length <= der.count else { return false }
            let first = der[start]
            if first >= 0x80 { return false }
            if first == 0x00 {
                // A leading zero is there only to keep a high first bit from reading as a sign.
                guard length >= 2, der[start + 1] >= 0x80 else { return false }
            } else if length == 33 {
                return false
            }
            position = start + length
        }
        return position == der.count
    }
}
