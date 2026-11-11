/// The refusal codes of the over-the-air format, the same ones `scripts/ota-error.mjs` and the
/// Android shell give. The shared cases in `apps/mobile/ota/fixtures` expect codes, never messages.
public enum OtaCode: String, CaseIterable, Sendable {
    case envelope = "ENVELOPE"
    case unknownKey = "UNKNOWN_KEY"
    case signature = "SIGNATURE"
    case payload = "PAYLOAD"
    case size = "SIZE"
    case sha256 = "SHA256"
    case xz = "XZ"
    case tar = "TAR"
    case entryType = "ENTRY_TYPE"
    case entryName = "ENTRY_NAME"
    case duplicate = "DUPLICATE"
    case noIndex = "NO_INDEX"
    case noEnv = "NO_ENV"
    case hasEnv = "HAS_ENV"
    case noHead = "NO_HEAD"
    case keys = "KEYS"
}

public struct OtaError: Error, Equatable, CustomStringConvertible, Sendable {
    public let code: OtaCode
    public let message: String

    public init(_ code: OtaCode, _ message: String) {
        self.code = code
        self.message = message
    }

    public var description: String { "\(code.rawValue): \(message)" }

    /// A bundle with this fault is refused the same way at every download, so the shell marks its
    /// version bad. SIZE and SHA256 are left out: they are what a cut or swapped download gives.
    public var isContentRefusal: Bool {
        switch code {
        case .xz, .tar, .entryType, .entryName, .duplicate, .noIndex, .hasEnv, .noHead:
            return true
        default:
            return false
        }
    }
}
