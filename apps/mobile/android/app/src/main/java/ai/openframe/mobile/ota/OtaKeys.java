package ai.openframe.mobile.ota;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

// A key's id is the first 16 lowercase hex digits of SHA-256 over its SPKI DER. Only the one 91-byte
// encoding of a P-256 key is taken (named curve, uncompressed point), the one every implementation
// hashes to the same id.
public final class OtaKeys {

    private static final byte[] P256_SPKI_PREFIX = {
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, (byte) 0x86, 0x48, (byte) 0xce, 0x3d, 0x02, 0x01,
        0x06, 0x08, 0x2a, (byte) 0x86, 0x48, (byte) 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
    };
    private static final int P256_SPKI_LENGTH = P256_SPKI_PREFIX.length + 65;

    private OtaKeys() {
    }

    public static String keyId(byte[] spki) {
        return Bytes.hex(Bytes.sha256().digest(spki)).substring(0, 16);
    }

    public static Map<String, PublicKey> of(byte[]... spkis) {
        Map<String, PublicKey> keys = new LinkedHashMap<>();
        for (byte[] spki : spkis) {
            keys.put(keyId(spki), publicKey(spki));
        }
        return Collections.unmodifiableMap(keys);
    }

    private static PublicKey publicKey(byte[] spki) {
        if (spki.length != P256_SPKI_LENGTH || Bytes.indexOf(spki, P256_SPKI_PREFIX, 0) != 0) {
            throw new IllegalArgumentException("not a P-256 key in the named-curve, uncompressed SPKI encoding");
        }
        try {
            return KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(spki));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("the key does not load", e);
        }
    }
}
