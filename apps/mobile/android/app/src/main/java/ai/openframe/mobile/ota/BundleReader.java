package ai.openframe.mobile.ota;

import org.tukaani.xz.SingleXZInputStream;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Reads an over-the-air bundle, a ustar archive in one xz stream, as it
 * decodes: neither the archive nor the tar is ever held in memory (a real
 * bundle unpacks to about 96 MB in 4,200 files). Every file that passes its
 * checks goes to the {@link Sink}, which the app points at its staging
 * directory and the tests at a hash, so both run the same code.
 *
 * The checks and their precedence are those of apps/mobile/docs/ota.md "The
 * bundle", pinned by fixtures/bundle-cases.json: a fault of the xz stream
 * outranks a fault of the tar, which outranks the first entry fault in archive
 * order, which outranks a missing or unusable index.html. So after an entry
 * fault the tar is still read to its end, and after a tar fault the xz stream
 * is still drained to its end. The size and SHA-256 of the compressed file
 * come before any of this: {@link #readVerified} is the whole sequence.
 */
public final class BundleReader {

    /** Takes the files of a bundle, in archive order. Whatever it has taken when {@link #read} throws is to be thrown away. */
    public interface Sink {
        /** Starts the file at {@code path}: relative, {@code /}-separated, and safe to create under the sink's own root. */
        void begin(String path, long size) throws IOException;

        void write(byte[] buffer, int offset, int length) throws IOException;

        void end() throws IOException;
    }

    private static final int BLOCK = 512;
    /** {@code xz -6}, what the release packs with, decodes in about 9 MiB; a stream asking for more than this is refused as XZ. */
    private static final int XZ_MEMORY_LIMIT_KIB = 64 * 1024;
    private static final int MAX_PATH = 255;
    private static final String INDEX = "index.html";

    /** The compressed input, remembering whether it failed itself: that is an I/O error, not a fault of the bundle. */
    private static final class Source extends InputStream {
        private final InputStream in;
        boolean failed;

        Source(InputStream in) {
            this.in = in;
        }

        @Override
        public int read() throws IOException {
            try {
                return in.read();
            } catch (IOException e) {
                failed = true;
                throw e;
            }
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            try {
                return in.read(buffer, offset, length);
            } catch (IOException e) {
                failed = true;
                throw e;
            }
        }
    }

    private final Source source;
    private final Sink sink;
    private InputStream tar;
    private final byte[] header = new byte[BLOCK];
    private final byte[] buffer = new byte[64 * 1024];
    /** Paths and the directories they need, ASCII lower-cased: a volume that ignores case would land Index.html on index.html. */
    private final Set<String> paths = new HashSet<>();
    private final Set<String> directories = new HashSet<>();
    private OtaError entryFault;
    private byte[] index;

    private BundleReader(InputStream archive, Sink sink) {
        this.source = new Source(archive);
        this.sink = sink;
    }

    /**
     * What a shell does with a downloaded bundle, in the one order the format
     * allows: its size (SIZE), then its SHA-256 (SHA256), against the signed
     * payload, and only then is a byte of it decoded, into {@code sink}.
     * Returns its root index.html, as {@link #read} does.
     *
     * @throws OtaError    the first refusal: the size, the hash, then the reader's by its own precedence
     * @throws IOException {@code archive} could not be read or the sink could not take a file
     */
    public static byte[] readVerified(File archive, long size, String sha256, Sink sink) throws OtaError, IOException {
        BundleCheck check = new BundleCheck(size, sha256);
        try (InputStream in = new FileInputStream(archive)) {
            byte[] chunk = new byte[64 * 1024];
            for (int read; (read = in.read(chunk)) != -1; ) {
                check.update(chunk, 0, read);
            }
        }
        check.finish();
        try (InputStream in = new BufferedInputStream(new FileInputStream(archive))) {
            return read(in, sink);
        }
    }

    /**
     * Reads the whole bundle from {@code archive} into {@code sink} and returns
     * its root index.html, which has passed the env copy's checks on a target.
     * Only for bytes whose size and SHA-256 are the signed ones: the app comes
     * here through {@link #readVerified}.
     *
     * @throws OtaError    the first refusal, by the precedence above
     * @throws IOException {@code archive} could not be read or the sink could not take a file
     */
    static byte[] read(InputStream archive, Sink sink) throws OtaError, IOException {
        return new BundleReader(archive, sink).read();
    }

    private byte[] read() throws OtaError, IOException {
        try {
            tar = new SingleXZInputStream(source, XZ_MEMORY_LIMIT_KIB);
        } catch (IOException e) {
            throw xzFault(e);
        }
        OtaError tarFault = readTar();
        // To the end of the stream whatever the tar was: only there are the last block's check, the index and the footer verified.
        int read;
        do {
            read = readSome(buffer, 0, buffer.length);
        } while (read != -1);
        // SingleXZInputStream stops at the end of its stream and leaves the input there.
        if (source.read() != -1) {
            throw new OtaError(OtaError.Code.XZ, "bytes after the xz stream: the bundle must be exactly one");
        }
        if (tarFault != null) {
            throw tarFault;
        }
        if (entryFault != null) {
            throw entryFault;
        }
        if (index == null) {
            throw new OtaError(OtaError.Code.NO_INDEX, "no index.html at the root of the bundle");
        }
        EnvCopy.assertTarget(index);
        return index;
    }

    /** Reads entries until the tar ends or is found malformed, and returns that fault, or null for a well-formed tar. */
    private OtaError readTar() throws OtaError, IOException {
        for (;;) {
            if (readFully(header, BLOCK) < BLOCK) {
                return tarFault("the tar ends without its end-of-archive blocks");
            }
            if (isZero(header, BLOCK)) {
                return readEndOfArchive();
            }
            if (!hasUstarMagic() || !hasValidChecksum()) {
                return tarFault("not a ustar header, or its checksum does not match");
            }
            long size = octal(124, 11);
            if (size < 0 || header[135] != 0) {
                return tarFault("a size field that is not eleven octal digits and a NUL");
            }
            String path = path();
            boolean taken = entryFault == null && takes(path);
            ByteArrayOutputStream indexBytes = taken && path.equals(INDEX) ? new ByteArrayOutputStream() : null;
            if (taken) {
                sink.begin(path, size);
            }
            long left = size;
            while (left > 0) {
                int read = readSome(buffer, 0, (int) Math.min(left, buffer.length));
                if (read == -1) {
                    return tarFault("an entry runs past the end of the archive");
                }
                if (taken) {
                    sink.write(buffer, 0, read);
                }
                if (indexBytes != null) {
                    indexBytes.write(buffer, 0, read);
                }
                left -= read;
            }
            if (taken) {
                sink.end();
            }
            if (indexBytes != null) {
                index = indexBytes.toByteArray();
            }
            // The padding to a whole block is read and never looked at.
            int padding = (int) ((BLOCK - size % BLOCK) % BLOCK);
            if (readFully(buffer, padding) < padding) {
                return tarFault("the tar ends without its end-of-archive blocks");
            }
        }
    }

    /** Past the first zero block: two or more whole zero blocks and nothing else, to the end of the stream. */
    private OtaError readEndOfArchive() throws OtaError, IOException {
        long length = BLOCK;
        boolean zero = true;
        for (int read; (read = readSome(buffer, 0, buffer.length)) != -1; length += read) {
            zero = zero && isZero(buffer, read);
        }
        return zero && length >= 2 * BLOCK && length % BLOCK == 0
            ? null
            : tarFault("anything but two or more zero blocks after the last entry");
    }

    /**
     * Whether the entry in {@code header} is a file to write. The first entry
     * that is not becomes the entry fault, and no entry after it is checked.
     */
    private boolean takes(String path) {
        // Only '0' is a regular file; the NUL that pre-POSIX tars wrote for one is refused with the rest.
        if (header[156] != '0') {
            entryFault = new OtaError(OtaError.Code.ENTRY_TYPE, "an entry that is not a regular file");
            return false;
        }
        if (!isSafePath(path)) {
            entryFault = new OtaError(OtaError.Code.ENTRY_NAME, "an entry with an unsafe path");
            return false;
        }
        String key = path.toLowerCase(Locale.ROOT);
        boolean collides = paths.contains(key) || directories.contains(key);
        for (int slash = key.indexOf('/'); slash != -1 && !collides; slash = key.indexOf('/', slash + 1)) {
            collides = paths.contains(key.substring(0, slash));
        }
        if (collides) {
            entryFault = new OtaError(OtaError.Code.DUPLICATE, path + " collides with another path");
            return false;
        }
        paths.add(key);
        for (int slash = key.indexOf('/'); slash != -1; slash = key.indexOf('/', slash + 1)) {
            directories.add(key.substring(0, slash));
        }
        return true;
    }

    /**
     * A relative path the shell may write as it is: 1 to 255 bytes, each
     * printable ASCII other than space and backslash, and split on {@code /}
     * no part empty, {@code .} or {@code ..}. So nothing absolute, no
     * directory entry and no way out of the bundle's directory.
     */
    static boolean isSafePath(String path) {
        if (path.isEmpty() || path.length() > MAX_PATH) {
            return false;
        }
        int partStart = 0;
        for (int i = 0; i <= path.length(); i++) {
            if (i < path.length() && path.charAt(i) != '/') {
                char c = path.charAt(i);
                if (c < 0x21 || c > 0x7e || c == '\\') {
                    return false;
                }
                continue;
            }
            String part = path.substring(partStart, i);
            if (part.isEmpty() || part.equals(".") || part.equals("..")) {
                return false;
            }
            partStart = i + 1;
        }
        return true;
    }

    /** The entry's path: its name field, after its prefix field and a {@code /} when that is not empty. One char per byte. */
    private String path() {
        String prefix = field(345, 155);
        String name = field(0, 100);
        return prefix.isEmpty() ? name : prefix + "/" + name;
    }

    /** A header field up to its first NUL. */
    private String field(int offset, int length) {
        int end = offset;
        while (end < offset + length && header[end] != 0) {
            end++;
        }
        return new String(header, offset, end - offset, StandardCharsets.ISO_8859_1);
    }

    /** The magic, five letters and a NUL, then the version. */
    private boolean hasUstarMagic() {
        return field(257, 6).equals("ustar") && header[263] == '0' && header[264] == '0';
    }

    /** Six octal digits, a NUL and a space, equal to the sum of the header's bytes with this field counted as spaces. */
    private boolean hasValidChecksum() {
        long stated = octal(148, 6);
        if (stated < 0 || header[154] != 0 || header[155] != ' ') {
            return false;
        }
        long sum = 0;
        for (int i = 0; i < BLOCK; i++) {
            sum += i >= 148 && i < 156 ? ' ' : header[i] & 0xff;
        }
        return stated == sum;
    }

    /** The value of {@code digits} octal digits at {@code offset}, or -1 unless every one is an ASCII 0-7. */
    private long octal(int offset, int digits) {
        long value = 0;
        for (int i = offset; i < offset + digits; i++) {
            if (header[i] < '0' || header[i] > '7') {
                return -1;
            }
            value = value << 3 | (header[i] - '0');
        }
        return value;
    }

    private static boolean isZero(byte[] bytes, int length) {
        for (int i = 0; i < length; i++) {
            if (bytes[i] != 0) {
                return false;
            }
        }
        return true;
    }

    private static OtaError tarFault(String message) {
        return new OtaError(OtaError.Code.TAR, message);
    }

    /** Reads {@code length} bytes of the tar, or as many as there are before the xz stream ends. */
    private int readFully(byte[] into, int length) throws OtaError, IOException {
        int total = 0;
        while (total < length) {
            int read = readSome(into, total, length - total);
            if (read == -1) {
                break;
            }
            total += read;
        }
        return total;
    }

    /** Bytes of the tar, or -1 once the xz stream has ended, as it must: with its index and footer verified. */
    private int readSome(byte[] into, int offset, int length) throws OtaError, IOException {
        try {
            return tar.read(into, offset, length);
        } catch (IOException e) {
            throw xzFault(e);
        }
    }

    /** What a failed read of the xz stream is: the input's own failure as it came, anything else a refusal of the stream. */
    private OtaError xzFault(IOException e) throws IOException {
        if (source.failed) {
            throw e;
        }
        return new OtaError(OtaError.Code.XZ, "not one intact xz stream: " + e);
    }
}
