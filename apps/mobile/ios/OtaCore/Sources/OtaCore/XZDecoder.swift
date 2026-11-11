import Compression

/// The system gave no decoder (`compression_stream_init` failed). Not an `OtaError`: the bundle
/// was not looked at, so nothing is known against it and its version must not be marked bad.
public struct XZDecoderUnavailable: Error {}

/// Decodes exactly one xz stream, as a stream: input goes in chunk by chunk and the decoded bytes
/// come out through a callback, so neither the archive nor the tar is ever whole in memory.
///
/// Apple's `COMPRESSION_LZMA` also decodes the legacy `.lzma` container, which has no magic, and
/// stops after the first xz stream without an error, where `xz` decodes every concatenated one.
/// So the magic is checked first, and the stream must end with every input byte consumed and
/// nothing after it, not even stream padding (docs/ota.md, "The bundle").
final class XZDecoder {
    private static let magic: [UInt8] = [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00]
    private static let outputCapacity = 64 * 1024

    private let stream: UnsafeMutablePointer<compression_stream>
    private let output: UnsafeMutablePointer<UInt8>
    private var header: [UInt8] = []
    private var ended = false

    init() throws {
        let stream = UnsafeMutablePointer<compression_stream>.allocate(capacity: 1)
        guard compression_stream_init(stream, COMPRESSION_STREAM_DECODE, COMPRESSION_LZMA) == COMPRESSION_STATUS_OK else {
            stream.deallocate()
            throw XZDecoderUnavailable()
        }
        self.stream = stream
        self.output = UnsafeMutablePointer<UInt8>.allocate(capacity: Self.outputCapacity)
    }

    deinit {
        compression_stream_destroy(stream)
        stream.deallocate()
        output.deallocate()
    }

    /// Decodes the next bytes of the archive. `decoded` is called with each run of output; what it
    /// throws stops the decoding and is rethrown.
    func decode(_ input: UnsafeRawBufferPointer, decoded: (UnsafeBufferPointer<UInt8>) throws -> Void) throws {
        guard input.count > 0 else { return }
        if header.count < Self.magic.count {
            header.append(contentsOf: input.prefix(Self.magic.count - header.count))
            guard header.elementsEqual(Self.magic.prefix(header.count)) else {
                throw OtaError(.xz, "not an xz stream")
            }
        }
        guard !ended else { throw OtaError(.xz, "bytes after the end of the xz stream") }
        stream.pointee.src_ptr = input.bindMemory(to: UInt8.self).baseAddress!
        stream.pointee.src_size = input.count
        try run(flags: 0, decoded: decoded)
        guard stream.pointee.src_size == 0 else { throw OtaError(.xz, "bytes after the end of the xz stream") }
    }

    /// Call once the archive has no more bytes: the stream must have ended by then.
    func finish(decoded: (UnsafeBufferPointer<UInt8>) throws -> Void) throws {
        guard header.count == Self.magic.count else { throw OtaError(.xz, "not an xz stream") }
        if !ended {
            stream.pointee.src_size = 0
            try run(flags: Int32(COMPRESSION_STREAM_FINALIZE.rawValue), decoded: decoded)
        }
        guard ended else { throw OtaError(.xz, "the xz stream is cut short") }
    }

    private func run(flags: Int32, decoded: (UnsafeBufferPointer<UInt8>) throws -> Void) throws {
        while !ended {
            stream.pointee.dst_ptr = output
            stream.pointee.dst_size = Self.outputCapacity
            let status = compression_stream_process(stream, flags)
            let produced = Self.outputCapacity - stream.pointee.dst_size
            if produced > 0 {
                try decoded(UnsafeBufferPointer(start: output, count: produced))
            }
            switch status {
            case COMPRESSION_STATUS_END:
                ended = true
            case COMPRESSION_STATUS_OK:
                // Out of input and the output buffer was not filled: the decoder waits for more.
                if stream.pointee.src_size == 0 && produced < Self.outputCapacity { return }
            default:
                throw OtaError(.xz, "the xz stream does not decode")
            }
        }
    }
}
