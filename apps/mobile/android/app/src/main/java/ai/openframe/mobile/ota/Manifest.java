package ai.openframe.mobile.ota;

import java.security.GeneralSecurityException;
import java.security.PublicKey;
import java.security.Signature;
import java.util.Map;

/**
 * mobile.json: the envelope {@code {keyId, payload, signature}} every release
 * publishes, and the payload it signs. {@link #verify} makes the checks of
 * apps/mobile/docs/ota.md "The manifest" in their order; fixtures/manifest-cases.json
 * holds this shell, the iOS one and the release scripts to the same outcome.
 */
public final class Manifest {

    private static final String FORMAT = "1";
    private static final String SHA256_DIGITS = "0123456789abcdef";

    /** The fields of a verified payload this format knows. */
    public static final class Payload {
        public final String version;
        public final int bridgeLevel;
        public final String url;
        public final long size;
        public final String sha256;

        Payload(String version, int bridgeLevel, String url, long size, String sha256) {
            this.version = version;
            this.bridgeLevel = bridgeLevel;
            this.url = url;
            this.size = size;
            this.sha256 = sha256;
        }
    }

    private Manifest() {
    }

    public static String bundleName(String version) {
        return "openframe-mobile-" + version + ".tar.xz";
    }

    /**
     * The payload of the manifest {@code manifest}, once its signature verifies
     * with one of {@code keys} (by key id, as {@link OtaKeys#of} gives them).
     */
    public static Payload verify(byte[] manifest, Map<String, PublicKey> keys) throws OtaError {
        Map<String, Object> envelope;
        try {
            envelope = Json.parseObject(manifest);
        } catch (Json.Malformed e) {
            throw new OtaError(OtaError.Code.ENVELOPE, "the manifest is not a JSON object: " + e.getMessage());
        }
        String keyId = envelopeString(envelope, "keyId");
        byte[] payload = Base64Strict.decode(envelopeString(envelope, "payload"));
        byte[] signature = Base64Strict.decode(envelopeString(envelope, "signature"));
        if (payload == null || signature == null) {
            throw new OtaError(OtaError.Code.ENVELOPE, "payload or signature is not canonical base64");
        }
        PublicKey key = keys.get(keyId);
        if (key == null) {
            throw new OtaError(OtaError.Code.UNKNOWN_KEY, "the manifest is signed by a key this build does not hold");
        }
        if (!isStrictDer(signature) || !verifies(key, payload, signature)) {
            throw new OtaError(OtaError.Code.SIGNATURE, "the signature does not verify with key " + keyId);
        }
        return payload(payload);
    }

    private static String envelopeString(Map<String, Object> envelope, String field) throws OtaError {
        Object value = envelope.get(field);
        if (!(value instanceof String)) {
            throw new OtaError(OtaError.Code.ENVELOPE, "the manifest has no \"" + field + "\" string");
        }
        return (String) value;
    }

    /**
     * Whether {@code signature} is the one DER encoding of an ECDSA signature:
     * a SEQUENCE of two INTEGERs, each positive and in its shortest form, every
     * length in the short form, and no byte after it. Checked here, before the
     * provider sees it, because providers differ on the rest: SunEC verifies a
     * signature whose r is written as a negative integer, Conscrypt does not.
     */
    static boolean isStrictDer(byte[] signature) {
        if (signature.length < 2 || signature[0] != 0x30) {
            return false;
        }
        int length = signature[1] & 0xff;
        if (length >= 0x80 || length != signature.length - 2) {
            return false;
        }
        int afterR = derIntegerEnd(signature, 2);
        return afterR != -1 && derIntegerEnd(signature, afterR) == signature.length;
    }

    /** The offset after the minimal positive INTEGER at {@code at}, or -1 when there is none. */
    private static int derIntegerEnd(byte[] der, int at) {
        if (at + 2 > der.length || der[at] != 0x02) {
            return -1;
        }
        int length = der[at + 1] & 0xff;
        int end = at + 2 + length;
        if (length == 0 || length >= 0x80 || end > der.length) {
            return -1;
        }
        int first = der[at + 2] & 0xff;
        boolean negative = first >= 0x80;
        boolean paddedWithZero = first == 0 && length > 1 && (der[at + 3] & 0xff) < 0x80;
        return negative || paddedWithZero ? -1 : end;
    }

    private static boolean verifies(PublicKey key, byte[] payload, byte[] signature) {
        try {
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(key);
            verifier.update(payload);
            return verifier.verify(signature);
        } catch (GeneralSecurityException e) {
            // A verifier may throw where another returns false; it does not verify either way.
            return false;
        }
    }

    private static Payload payload(byte[] bytes) throws OtaError {
        Map<String, Object> fields;
        try {
            fields = Json.parseObject(bytes);
        } catch (Json.Malformed e) {
            throw refused("is not a JSON object: " + e.getMessage());
        }
        // Fields this format does not know are ignored (docs/ota.md, "The rules").
        Object format = fields.get("format");
        if (!(format instanceof Json.Num) || !FORMAT.equals(((Json.Num) format).text)) {
            throw refused("format is not " + FORMAT);
        }
        Object version = fields.get("version");
        if (!(version instanceof String) || !Version.isValid((String) version)) {
            throw refused("version is not x.y.z");
        }
        long bridgeLevel = positiveInteger(fields.get("bridgeLevel"));
        if (bridgeLevel < 1 || bridgeLevel > Integer.MAX_VALUE) {
            throw refused("bridgeLevel is not a whole number of at least 1");
        }
        long size = positiveInteger(fields.get("size"));
        if (size < 1) {
            throw refused("size is not a whole number of at least 1");
        }
        Object sha256 = fields.get("sha256");
        if (!(sha256 instanceof String) || !isSha256((String) sha256)) {
            throw refused("sha256 is not 64 lowercase hex digits");
        }
        Object url = fields.get("url");
        if (!(url instanceof String) || !namesBundle((String) url, (String) version)) {
            throw refused("url does not name " + bundleName((String) version) + " over https");
        }
        return new Payload((String) version, (int) bridgeLevel, (String) url, size, (String) sha256);
    }

    private static OtaError refused(String what) {
        return new OtaError(OtaError.Code.PAYLOAD, "the payload's " + what);
    }

    private static long positiveInteger(Object value) {
        return value instanceof Json.Num ? ((Json.Num) value).positiveInteger() : -1;
    }

    private static boolean isSha256(String text) {
        if (text.length() != 64) {
            return false;
        }
        for (int i = 0; i < text.length(); i++) {
            if (SHA256_DIGITS.indexOf(text.charAt(i)) == -1) {
                return false;
            }
        }
        return true;
    }

    /** Compared as text, never parsed: no query or fragment can carry the file name instead. */
    private static boolean namesBundle(String url, String version) {
        return url.startsWith("https://")
            && url.indexOf('?') == -1
            && url.indexOf('#') == -1
            && url.endsWith("/" + bundleName(version));
    }
}
