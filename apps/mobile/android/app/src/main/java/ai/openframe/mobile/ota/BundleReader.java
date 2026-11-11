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

// Read as it decodes: neither the archive nor the tar is ever held in memory (a real bundle unpacks to
// about 96 MB in 4,200 files).
//
// The checks and their precedence are those of apps/mobile/docs/ota.md "The bundle", pinned by
// fixtures/bundle-cases.json: a fault of the xz stream outranks a fault of the tar, which outranks the
// first entry fault in archive order, which outranks a missing or unusable index.html. So after an entry
// fault the tar is still read to its end, and after a tar fault the xz stream is still drained to its end.
public final class BundleReader {

    // Whatever it has taken when read throws is to be thrown away.
    public interface Sink {
        void begin(String path, long size) throws IOException;

        void write(byte[] buffer, int offset, int length) throws IOException;

        void end() throws IOException;
    }

    private static final int BLOCK = 512;
    // xz -6, what the release packs with, decodes in about 9 MiB; a stream asking for more than this is refused as XZ.
    private static final int XZ_MEMORY_LIMIT_KIB = 64 * 1024;
    private static final int MAX_PATH = 255;
    private static final String INDEX = "index.html";

    // Remembers whether the compressed input failed itself: that is an I/O error, not a fault of the bundle.
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
    // ASCII lower-cased: a volume that ignores case would land Index.html on index.html.
    private final Set<String> paths = new HashSet<>();
    private final Set<String> directories = new HashSet<>();
    private OtaError entryFault;
    private byte[] index;

    private BundleReader(InputStream archive, Sink sink) {
        this.source = new Source(archive);
        this.sink = sink;
    }

    // The one order the format allows: the size (SIZE), then the SHA-256 (SHA256), against the signed
    // payload, and only then is a byte of it decoded.
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

    // Only for bytes whose size and SHA-256 are the signed ones: the app comes here through readVerified.
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

    // The first entry that is not a file to write becomes the entry fault, and no entry after it is checked.
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

    // Nothing absolute, no directory entry and no way out of the bundle's directory.
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

    // One char per byte.
    private String path() {
        String prefix = field(345, 155);
        String name = field(0, 100);
        return prefix.isEmpty() ? name : prefix + "/" + name;
    }

    private String field(int offset, int length) {
        int end = offset;
        while (end < offset + length && header[end] != 0) {
            end++;
        }
        return new String(header, offset, end - offset, StandardCharsets.ISO_8859_1);
    }

    private boolean hasUstarMagic() {
        return field(257, 6).equals("ustar") && header[263] == '0' && header[264] == '0';
    }

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

    private int readSome(byte[] into, int offset, int length) throws OtaError, IOException {
        try {
            return tar.read(into, offset, length);
        } catch (IOException e) {
            throw xzFault(e);
        }
    }

    private OtaError xzFault(IOException e) throws IOException {
        if (source.failed) {
            throw e;
        }
        return new OtaError(OtaError.Code.XZ, "not one intact xz stream: " + e);
    }
}
