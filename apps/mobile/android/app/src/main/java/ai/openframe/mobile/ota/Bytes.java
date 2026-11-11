package ai.openframe.mobile.ota;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Byte helpers of the format code: everything in it is compared as bytes, never as text. */
final class Bytes {

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
