package ai.openframe.mobile.ota;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Byte helpers: the format code compares as bytes, never as text, and the shell reads a stream up to a limit. */
public final class Bytes {

    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private Bytes() {
    }

    static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }

    static String hex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            out[2 * i] = HEX[(bytes[i] >> 4) & 0x0f];
            out[2 * i + 1] = HEX[bytes[i] & 0x0f];
        }
        return new String(out);
    }

    static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("every Java platform has SHA-256", e);
        }
    }

    /**
     * What is left of {@code in}, or null as soon as it gives more than
     * {@code limit} bytes, without reading on. {@code Integer.MAX_VALUE} sets
     * no limit of its own: no array holds more. (InputStream.readAllBytes is
     * API 33, above minSdk.)
     */
    public static byte[] readAtMost(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] chunk = new byte[8 * 1024];
        for (int read; (read = in.read(chunk)) != -1; ) {
            if (read > limit - out.size()) {
                return null;
            }
            out.write(chunk, 0, read);
        }
        return out.toByteArray();
    }

    /** Where {@code needle} first starts in {@code haystack} at or after {@code from}, or -1. */
    static int indexOf(byte[] haystack, byte[] needle, int from) {
        for (int start = from; start <= haystack.length - needle.length; start++) {
            int matched = 0;
            while (matched < needle.length && haystack[start + matched] == needle[matched]) {
                matched++;
            }
            if (matched == needle.length) {
                return start;
            }
        }
        return -1;
    }
}
