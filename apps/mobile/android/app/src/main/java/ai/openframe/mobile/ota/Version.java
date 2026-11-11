package ai.openframe.mobile.ota;

/**
 * A release version, {@code x.y.z}: three parts joined by a dot, each
 * {@code 0} or an ASCII 1-9 followed by at most eight ASCII digits, so each
 * fits an int. No sign, no suffix, no other digit: {@code Integer.parseInt}
 * would take a plus sign and any Unicode digit.
 */
public final class Version {

    private Version() {
    }

    public static boolean isValid(String text) {
        return text != null && parts(text) != null;
    }

    /** Below zero, zero or above as {@code a} is below, at or above {@code b}: by number, so 1.10.0 is above 1.9.0. */
    public static int compare(String a, String b) {
        int[] left = parts(a);
        int[] right = parts(b);
        if (left == null || right == null) {
            throw new IllegalArgumentException("not a version");
        }
        for (int i = 0; i < 3; i++) {
            if (left[i] != right[i]) {
                return left[i] < right[i] ? -1 : 1;
            }
        }
        return 0;
    }

    private static int[] parts(String text) {
        int[] parts = new int[3];
        int at = 0;
        for (int part = 0; part < 3; part++) {
            int start = at;
            int value = 0;
            while (at < text.length() && text.charAt(at) >= '0' && text.charAt(at) <= '9') {
                value = value * 10 + (text.charAt(at) - '0');
                at++;
                if (at - start > 9) {
                    return null;
                }
            }
            int digits = at - start;
            if (digits == 0 || digits > 1 && text.charAt(start) == '0') {
                return null;
            }
            parts[part] = value;
            if (part < 2) {
                if (at >= text.length() || text.charAt(at) != '.') {
                    return null;
                }
                at++;
            }
        }
        return at == text.length() ? parts : null;
    }
}
