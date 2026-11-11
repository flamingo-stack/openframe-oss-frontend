/// A release version `x.y.z`: three parts, each `0` or an ASCII 1-9 followed by at most eight
/// ASCII digits, so each fits 32 bits. Compared as three numbers: 1.10.0 is above 1.9.0.
public struct OtaVersion: Hashable, Comparable, CustomStringConvertible, Sendable {
    public let major: UInt32
    public let minor: UInt32
    public let patch: UInt32

    public init?(_ text: String) {
        self.init(utf8: Array(text.utf8))
    }

    /// The grammar is checked on bytes: Swift's `\d` and `Int("٣")` take any Unicode digit.
    public init?(utf8 bytes: [UInt8]) {
        let parts = bytes.split(separator: UInt8(ascii: "."), omittingEmptySubsequences: false)
        guard parts.count == 3,
              let major = Self.part(parts[0]), let minor = Self.part(parts[1]), let patch = Self.part(parts[2])
        else { return nil }
        self.major = major
        self.minor = minor
        self.patch = patch
    }

    private static func part(_ digits: ArraySlice<UInt8>) -> UInt32? {
        guard let first = digits.first, digits.count <= 9, digits.count == 1 || first != UInt8(ascii: "0") else {
            return nil
        }
        var value: UInt32 = 0
        for byte in digits {
            guard byte >= UInt8(ascii: "0"), byte <= UInt8(ascii: "9") else { return nil }
            value = value * 10 + UInt32(byte - UInt8(ascii: "0"))
        }
        return value
    }

    public var description: String { "\(major).\(minor).\(patch)" }

    public static func < (lhs: OtaVersion, rhs: OtaVersion) -> Bool {
        (lhs.major, lhs.minor, lhs.patch) < (rhs.major, rhs.minor, rhs.patch)
    }
}
