/// A JSON value with JSON's own types: `true` is not the number 1, which `JSONSerialization`
/// would make it. Strings and keys are UTF-8 bytes, because the format compares text as bytes
/// and a Swift `String` compares by canonical equivalence.
public enum JSONValue: Equatable {
    case null
    case bool(Bool)
    /// The number as it is spelled.
    case number([UInt8])
    case string([UInt8])
    case array([JSONValue])
    /// A key given twice keeps its last value, as `JSON.parse` does.
    case object([[UInt8]: JSONValue])

    public subscript(key: String) -> JSONValue? {
        guard case .object(let members) = self else { return nil }
        return members[Array(key.utf8)]
    }

    public var stringBytes: [UInt8]? {
        guard case .string(let bytes) = self else { return nil }
        return bytes
    }

    /// The value of a number spelled as an integer (no fraction, no exponent) that fits 64 bits.
    public var integer: Int64? {
        guard case .number(let literal) = self else { return nil }
        var digits = literal[...]
        let negative = digits.first == UInt8(ascii: "-")
        if negative { digits = digits.dropFirst() }
        guard !digits.isEmpty else { return nil }
        var value: Int64 = 0
        for byte in digits {
            guard byte >= UInt8(ascii: "0"), byte <= UInt8(ascii: "9") else { return nil }
            let (shifted, overflowed) = value.multipliedReportingOverflow(by: 10)
            let digit = Int64(byte - UInt8(ascii: "0"))
            let (next, overflowedAgain) = negative
                ? shifted.subtractingReportingOverflow(digit)
                : shifted.addingReportingOverflow(digit)
            guard !overflowed, !overflowedAgain else { return nil }
            value = next
        }
        return value
    }
}

/// RFC 8259 and nothing more: valid UTF-8, no byte order mark, no comments, no trailing commas,
/// nothing but whitespace after the value. Arrays and objects nest at most `maxDepth` deep, which
/// bounds the parser's recursion on input nobody has signed yet.
public enum StrictJSON {
    public static let maxDepth = 32

    /// The value `bytes` spell, or nil when they are not strict JSON.
    public static func parse(_ bytes: [UInt8]) -> JSONValue? {
        guard isValidUTF8(bytes) else { return nil }
        var parser = Parser(bytes: bytes)
        parser.skipWhitespace()
        guard let value = parser.value(depth: 0) else { return nil }
        parser.skipWhitespace()
        return parser.position == bytes.count ? value : nil
    }

    public static func isValidUTF8(_ bytes: [UInt8]) -> Bool {
        var decoder = UTF8()
        var iterator = bytes.makeIterator()
        while true {
            switch decoder.decode(&iterator) {
            case .scalarValue: continue
            case .emptyInput: return true
            case .error: return false
            }
        }
    }

    private struct Parser {
        let bytes: [UInt8]
        var position = 0

        var current: UInt8? { position < bytes.count ? bytes[position] : nil }

        mutating func skipWhitespace() {
            while let byte = current, byte == 0x20 || byte == 0x09 || byte == 0x0A || byte == 0x0D {
                position += 1
            }
        }

        mutating func take(_ byte: UInt8) -> Bool {
            guard current == byte else { return false }
            position += 1
            return true
        }

        mutating func take(literal: StaticString) -> Bool {
            let end = position + literal.utf8CodeUnitCount
            guard end <= bytes.count else { return false }
            let matches = literal.withUTF8Buffer { $0.elementsEqual(bytes[position..<end]) }
            if matches { position = end }
            return matches
        }

        mutating func value(depth: Int) -> JSONValue? {
            switch current {
            case UInt8(ascii: "{"): return depth < StrictJSON.maxDepth ? object(depth: depth + 1) : nil
            case UInt8(ascii: "["): return depth < StrictJSON.maxDepth ? array(depth: depth + 1) : nil
            case UInt8(ascii: "\""): return string().map(JSONValue.string)
            case UInt8(ascii: "t"): return take(literal: "true") ? .bool(true) : nil
            case UInt8(ascii: "f"): return take(literal: "false") ? .bool(false) : nil
            case UInt8(ascii: "n"): return take(literal: "null") ? .null : nil
            default: return number()
            }
        }

        mutating func object(depth: Int) -> JSONValue? {
            position += 1
            var members: [[UInt8]: JSONValue] = [:]
            skipWhitespace()
            if take(UInt8(ascii: "}")) { return .object(members) }
            while true {
                skipWhitespace()
                guard current == UInt8(ascii: "\""), let key = string() else { return nil }
                skipWhitespace()
                guard take(UInt8(ascii: ":")) else { return nil }
                skipWhitespace()
                guard let member = value(depth: depth) else { return nil }
                members[key] = member
                skipWhitespace()
                if take(UInt8(ascii: "}")) { return .object(members) }
                guard take(UInt8(ascii: ",")) else { return nil }
            }
        }

        mutating func array(depth: Int) -> JSONValue? {
            position += 1
            var elements: [JSONValue] = []
            skipWhitespace()
            if take(UInt8(ascii: "]")) { return .array(elements) }
            while true {
                skipWhitespace()
                guard let element = value(depth: depth) else { return nil }
                elements.append(element)
                skipWhitespace()
                if take(UInt8(ascii: "]")) { return .array(elements) }
                guard take(UInt8(ascii: ",")) else { return nil }
            }
        }

        mutating func string() -> [UInt8]? {
            position += 1
            var out: [UInt8] = []
            while let byte = current {
                position += 1
                switch byte {
                case UInt8(ascii: "\""):
                    return out
                case UInt8(ascii: "\\"):
                    guard appendEscape(to: &out) else { return nil }
                case 0x00..<0x20:
                    return nil
                default:
                    out.append(byte)
                }
            }
            return nil
        }

        private mutating func appendEscape(to out: inout [UInt8]) -> Bool {
            guard let escape = current else { return false }
            position += 1
            switch escape {
            case UInt8(ascii: "\""), UInt8(ascii: "\\"), UInt8(ascii: "/"): out.append(escape)
            case UInt8(ascii: "b"): out.append(0x08)
            case UInt8(ascii: "f"): out.append(0x0C)
            case UInt8(ascii: "n"): out.append(0x0A)
            case UInt8(ascii: "r"): out.append(0x0D)
            case UInt8(ascii: "t"): out.append(0x09)
            case UInt8(ascii: "u"):
                guard let unit = hexUnit() else { return false }
                var scalar = unit
                if (0xD800..<0xDC00).contains(unit) {
                    // A high surrogate stands only with its low half; a lone one is no character.
                    guard take(UInt8(ascii: "\\")), take(UInt8(ascii: "u")),
                          let low = hexUnit(), (0xDC00..<0xE000).contains(low) else { return false }
                    scalar = 0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00)
                }
                guard let character = Unicode.Scalar(scalar) else { return false }
                UTF8.encode(character) { out.append($0) }
            default:
                return false
            }
            return true
        }

        private mutating func hexUnit() -> UInt32? {
            guard position + 4 <= bytes.count else { return nil }
            var unit: UInt32 = 0
            for byte in bytes[position..<position + 4] {
                let digit: UInt8
                switch byte {
                case UInt8(ascii: "0")...UInt8(ascii: "9"): digit = byte - UInt8(ascii: "0")
                case UInt8(ascii: "a")...UInt8(ascii: "f"): digit = byte - UInt8(ascii: "a") + 10
                case UInt8(ascii: "A")...UInt8(ascii: "F"): digit = byte - UInt8(ascii: "A") + 10
                default: return nil
                }
                unit = unit << 4 | UInt32(digit)
            }
            position += 4
            return unit
        }

        mutating func number() -> JSONValue? {
            let start = position
            _ = take(UInt8(ascii: "-"))
            if !take(UInt8(ascii: "0")) {
                guard let first = current, first >= UInt8(ascii: "1"), first <= UInt8(ascii: "9") else { return nil }
                skipDigits()
            }
            if take(UInt8(ascii: ".")) {
                guard skipDigits() else { return nil }
            }
            if take(UInt8(ascii: "e")) || take(UInt8(ascii: "E")) {
                if !take(UInt8(ascii: "+")) { _ = take(UInt8(ascii: "-")) }
                guard skipDigits() else { return nil }
            }
            return .number(Array(bytes[start..<position]))
        }

        @discardableResult
        private mutating func skipDigits() -> Bool {
            let start = position
            while let byte = current, byte >= UInt8(ascii: "0"), byte <= UInt8(ascii: "9") {
                position += 1
            }
            return position > start
        }
    }
}
