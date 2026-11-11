package ai.openframe.mobile.ota;

// Canonical base64 only: the standard alphabet, padded to a multiple of four, the unused bits of the
// last digit zero, no whitespace. That is exactly the text an encoder writes, so decoding and
// re-encoding gives it back, which is the rule the release scripts check by. android.util.Base64 and
// java.util.Base64 (API 26, above this app's minimum) both take more.
public final class Base64Strict {

    private Base64Strict() {
    }

    public static byte[] decode(String text) {
        int length = text.length();
        if (length % 4 != 0) {
            return null;
        }
        if (length == 0) {
            return new byte[0];
        }
        int padding = text.charAt(length - 1) != '=' ? 0 : text.charAt(length - 2) != '=' ? 1 : 2;
        byte[] out = new byte[length / 4 * 3 - padding];
        int written = 0;
        for (int i = 0; i < length; i += 4) {
            boolean last = i + 4 == length;
            int a = digit(text.charAt(i));
            int b = digit(text.charAt(i + 1));
            int c = last && padding == 2 ? 0 : digit(text.charAt(i + 2));
            int d = last && padding >= 1 ? 0 : digit(text.charAt(i + 3));
            if ((a | b | c | d) < 0) {
                return null;
            }
            if (last && (padding == 2 && (b & 0x0f) != 0 || padding == 1 && (c & 0x03) != 0)) {
                return null;
            }
            int word = a << 18 | b << 12 | c << 6 | d;
            out[written++] = (byte) (word >> 16);
            if (written < out.length) {
                out[written++] = (byte) (word >> 8);
            }
            if (written < out.length) {
                out[written++] = (byte) word;
            }
        }
        return out;
    }

    private static int digit(char c) {
        if (c >= 'A' && c <= 'Z') {
            return c - 'A';
        }
        if (c >= 'a' && c <= 'z') {
            return c - 'a' + 26;
        }
        if (c >= '0' && c <= '9') {
            return c - '0' + 52;
        }
        if (c == '+') {
            return 62;
        }
        if (c == '/') {
            return 63;
        }
        return -1;
    }
}
