protocol TarEntryHandler: AnyObject {
    func entryBegan(type: UInt8, path: [UInt8], size: Int64) throws
    func entryData(_ bytes: UnsafeBufferPointer<UInt8>) throws
    func entryEnded() throws
}

/// Reads a ustar archive as a stream, in the exact layout `scripts/ota-tar.mjs` writes and no
/// other (docs/ota.md, the TAR group). Of each header only magic, version, checksum, size, type,
/// name and prefix are read; mode, owner, times and the rest are never looked at, let alone
/// applied. Every refusal is TAR; what the handler throws is rethrown as it is.
struct TarReader {
    private static let block = 512
    private static let magic = Array("ustar\0".utf8) + Array("00".utf8)

    private enum Phase {
        case header
        case data(remaining: Int64, padding: Int)
        case padding(remaining: Int)
        /// From the first all-zero block on: only zeros may follow.
        case end(length: Int64)
    }

    private var phase = Phase.header
    private var header: [UInt8] = []

    mutating func read(_ bytes: UnsafeBufferPointer<UInt8>, handler: TarEntryHandler) throws {
        var rest = bytes[...]
        while !rest.isEmpty {
            switch phase {
            case .header:
                let taken = rest.prefix(Self.block - header.count)
                header.append(contentsOf: taken)
                rest = rest.dropFirst(taken.count)
                if header.count == Self.block {
                    try headerRead(handler: handler)
                    header.removeAll(keepingCapacity: true)
                }
            case .data(let remaining, let padding):
                let taken = rest.prefix(Int(min(remaining, Int64(rest.count))))
                try handler.entryData(UnsafeBufferPointer(rebasing: taken))
                rest = rest.dropFirst(taken.count)
                if remaining == Int64(taken.count) {
                    try handler.entryEnded()
                    phase = padding > 0 ? .padding(remaining: padding) : .header
                } else {
                    phase = .data(remaining: remaining - Int64(taken.count), padding: padding)
                }
            case .padding(let remaining):
                let skipped = min(remaining, rest.count)
                rest = rest.dropFirst(skipped)
                phase = skipped == remaining ? .header : .padding(remaining: remaining - skipped)
            case .end(let length):
                guard rest.allSatisfy({ $0 == 0 }) else {
                    throw OtaError(.tar, "bytes after the end-of-archive blocks")
                }
                phase = .end(length: length + Int64(rest.count))
                rest = rest.dropFirst(rest.count)
            }
        }
    }

    /// Call once the tar has no more bytes: it must have ended in two or more whole zero blocks.
    func finish() throws {
        guard case .end(let length) = phase, length >= 2 * Int64(Self.block), length % Int64(Self.block) == 0 else {
            throw OtaError(.tar, "the tar does not end in two or more whole zero blocks")
        }
    }

    private mutating func headerRead(handler: TarEntryHandler) throws {
        if header.allSatisfy({ $0 == 0 }) {
            phase = .end(length: Int64(Self.block))
            return
        }
        guard header[257..<265].elementsEqual(Self.magic) else {
            throw OtaError(.tar, "no ustar header")
        }
        // Six octal digits, NUL, space; the sum counts the field itself as eight spaces.
        guard let stated = Self.octal(header[148..<154]), header[154] == 0, header[155] == 0x20 else {
            throw OtaError(.tar, "the header checksum is not six octal digits, NUL, space")
        }
        var sum: Int64 = 0
        for (offset, byte) in header.enumerated() {
            sum += (148..<156).contains(offset) ? 0x20 : Int64(byte)
        }
        guard stated == sum else { throw OtaError(.tar, "header checksum mismatch") }
        guard let size = Self.octal(header[124..<135]), header[135] == 0 else {
            throw OtaError(.tar, "the size field is not eleven octal digits and a NUL")
        }
        let name = Self.field(header[0..<100])
        let prefix = Self.field(header[345..<500])
        let path = prefix.isEmpty ? name : prefix + [UInt8(ascii: "/")] + name
        try handler.entryBegan(type: header[156], path: path, size: size)
        if size == 0 {
            try handler.entryEnded()
            return
        }
        let padding = (Self.block - Int(size % Int64(Self.block))) % Self.block
        phase = .data(remaining: size, padding: padding)
    }

    /// The value of a field of ASCII `0`-`7` only: no sign, no space, no NUL.
    private static func octal(_ digits: ArraySlice<UInt8>) -> Int64? {
        var value: Int64 = 0
        for byte in digits {
            guard byte >= UInt8(ascii: "0"), byte <= UInt8(ascii: "7") else { return nil }
            value = value << 3 | Int64(byte - UInt8(ascii: "0"))
        }
        return value
    }

    /// A text field, read up to its first NUL.
    private static func field(_ bytes: ArraySlice<UInt8>) -> [UInt8] {
        Array(bytes.prefix(while: { $0 != 0 }))
    }
}
