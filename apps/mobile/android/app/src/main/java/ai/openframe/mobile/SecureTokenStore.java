package ai.openframe.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.MGF1ParameterSpec;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.crypto.spec.SecretKeySpec;

/**
 * Android-Keystore-backed secure storage for the auth tokens — the Android
 * counterpart to the iOS Keychain block in NativeAuthPlugin.swift.
 *
 * Both the access token and the refresh token are stored as ONE combined item
 * (a small JSON object {"accessToken":..,"refreshToken":..}, absent fields
 * omitted). A single ciphertext + single wrapped content key means a gated read
 * performs exactly ONE BiometricPrompt / CryptoObject unwrap for the whole pair
 * — the frontend always writes the full current pair, so there is no need to
 * merge with existing stored values (which would require a gated read on write).
 *
 * Two storage modes share one on-disk SharedPreferences file (only one is
 * populated at a time):
 *
 * 1. UNGATED (biometric off, the default). The AES-256-GCM master key is
 *    generated in and never leaves the AndroidKeyStore: non-exportable,
 *    hardware-backed where available, inherently excluded from cloud/adb backup
 *    — matching the iOS Keychain kSecAttrAccessibleWhenUnlockedThisDeviceOnly
 *    intent. No setUserAuthenticationRequired: iOS WhenUnlocked forces no
 *    per-read prompt either — the device merely has to be unlocked. Reads and
 *    writes are both silent.
 *
 * 2. GATED (biometric on). Hybrid envelope: each write generates a fresh random
 *    AES-256-GCM content key, AES-encrypts the combined blob with it, and WRAPS
 *    that content key with a biometric-gated RSA-2048/OAEP PUBLIC key. Wrapping
 *    with the public key needs no authentication, so token-refresh writes stay
 *    SILENT (no prompt). The matching RSA PRIVATE key carries
 *    setUserAuthenticationRequired(true) + AUTH_BIOMETRIC_STRONG, so it can only
 *    be used inside a BiometricPrompt CryptoObject — the read path (unwrap of
 *    the single content key) is the only thing that ever prompts. This is
 *    deliberately NOT the "authenticate then read an unprotected blob"
 *    antipattern: the ciphertext is worthless without the Keystore-held private
 *    key, whose use is hardware-enforced to require a fresh biometric.
 *    setInvalidatedByBiometricEnrollment(true) drops the key if a new
 *    fingerprint/face is enrolled.
 */
final class SecureTokenStore {

    // Combined item account — one blob holds both tokens.
    static final String COMBINED = "tokens";

    // Legacy two-item accounts (older installs stored each token separately).
    // Kept only so setTokens()/clearTokens() can delete stale orphans, including
    // gated orphans that would otherwise linger after enabling biometrics.
    static final String LEGACY_ACCESS_TOKEN = "accessToken";
    static final String LEGACY_REFRESH_TOKEN = "refreshToken";

    // Mirrors the iOS Keychain service string.
    private static final String PREFS_NAME = "ai.openframe.mobile.auth";
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";

    private static final String KEY_ALIAS = "ai.openframe.mobile.auth.master";
    // .v2: the pre-fix biometric keypair wrapped with OAEP but no explicit MGF1
    // params and could not be unwrapped on devices where the public-key wrap ran
    // in a software provider (MGF1-SHA256) while the Keystore unwrap used MGF1-SHA1.
    // A new alias forces a fresh keypair with the corrected pinned params below.
    private static final String BIO_KEY_ALIAS = "ai.openframe.mobile.auth.bio.v2";

    // Records whether tokens are currently stored biometric-gated. Read by
    // isBiometricLoginEnabled() and getTokens() (both MUST NOT prompt).
    private static final String BIO_ENABLED_MARKER = "biometricLoginEnabled";

    // JSON field names inside the combined plaintext blob.
    private static final String JSON_ACCESS = "accessToken";
    private static final String JSON_REFRESH = "refreshToken";

    private static final String AES_TRANSFORMATION =
        KeyProperties.KEY_ALGORITHM_AES + "/" + KeyProperties.BLOCK_MODE_GCM + "/" + KeyProperties.ENCRYPTION_PADDING_NONE;
    // OAEP with a SHA-256 label + MGF1. AndroidKeyStore's Keystore provider uses
    // MGF1-SHA1 in hardware regardless of the digest string, but the public-key
    // WRAP can be handled by a software provider that defaults to MGF1-SHA256 —
    // then the Keystore private-key UNWRAP throws BadPaddingException (this was
    // the biometric-read failure). Pinning OAEP_PARAMS (MGF1 = SHA-1) on BOTH
    // init calls makes wrap and unwrap agree across providers/devices; the bio
    // keypair authorizes SHA-1 so MGF1-SHA1 is permitted.
    private static final String RSA_TRANSFORMATION = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";
    private static final OAEPParameterSpec OAEP_PARAMS = new OAEPParameterSpec(
        "SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT);

    private static final int GCM_TAG_BITS = 128;
    private static final int CONTENT_KEY_BITS = 256;

    // Ungated layout: <account> = ciphertext, <account>.iv = GCM IV.
    private static final String IV_SUFFIX = ".iv";
    // Gated layout: <account>.g = ciphertext, <account>.g.iv = GCM IV,
    //               <account>.g.k = RSA-wrapped content key.
    private static final String GATED_CT_SUFFIX = ".g";
    private static final String GATED_IV_SUFFIX = ".g.iv";
    private static final String GATED_KEY_SUFFIX = ".g.k";

    private final SharedPreferences prefs;

    SecureTokenStore(Context context) {
        this.prefs = context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // ─── Combined-blob JSON codec ─────────────────────────────────────────────

    /** Encodes the pair into the combined JSON plaintext, omitting absent fields. */
    static String encodePair(String accessToken, String refreshToken) {
        org.json.JSONObject json = new org.json.JSONObject();
        try {
            if (accessToken != null) {
                json.put(JSON_ACCESS, accessToken);
            }
            if (refreshToken != null) {
                json.put(JSON_REFRESH, refreshToken);
            }
        } catch (org.json.JSONException e) {
            throw new RuntimeException("Token blob encode failed", e);
        }
        return json.toString();
    }

    /** Reads a field out of a combined JSON plaintext; null if absent/blank. */
    static String pairField(String json, String field) {
        if (json == null) {
            return null;
        }
        try {
            org.json.JSONObject obj = new org.json.JSONObject(json);
            String v = obj.optString(field, null);
            return (v == null || v.isEmpty()) ? null : v;
        } catch (org.json.JSONException e) {
            return null;
        }
    }

    // ─── Ungated (biometric off) — silent read/write ─────────────────────────

    /** @param value null clears the entry (mirrors iOS skipping an absent key). */
    synchronized void write(String account, String value) {
        if (value == null) {
            delete(account);
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, masterKey());
            byte[] iv = cipher.getIV();
            byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            prefs.edit()
                .putString(account, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString(account + IV_SUFFIX, Base64.encodeToString(iv, Base64.NO_WRAP))
                .apply();
        } catch (Exception e) {
            throw new RuntimeException("Keystore encrypt failed for " + account, e);
        }
    }

    synchronized String read(String account) {
        String encoded = prefs.getString(account, null);
        String encodedIv = prefs.getString(account + IV_SUFFIX, null);
        if (encoded == null || encodedIv == null) {
            return null;
        }
        try {
            byte[] ciphertext = Base64.decode(encoded, Base64.NO_WRAP);
            byte[] iv = Base64.decode(encodedIv, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, masterKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Key rotated/invalidated or corrupt entry — treat as no token, drop the stale blob.
            delete(account);
            return null;
        }
    }

    synchronized void delete(String account) {
        prefs.edit().remove(account).remove(account + IV_SUFFIX).apply();
    }

    // ─── Gated (biometric on) — silent write, prompted read ──────────────────

    /**
     * Silent write of a biometric-gated entry. Generates a per-write AES content
     * key, AES-GCM-encrypts the blob with it, and wraps the content key with the
     * biometric-gated RSA public key. No BiometricPrompt — wrapping is public-key
     * only.
     */
    synchronized void writeGated(String account, String value) {
        if (value == null) {
            deleteGated(account);
            return;
        }
        try {
            byte[] contentKeyBytes = new byte[CONTENT_KEY_BITS / 8];
            new java.security.SecureRandom().nextBytes(contentKeyBytes);
            SecretKey contentKey = new SecretKeySpec(contentKeyBytes, KeyProperties.KEY_ALGORITHM_AES);

            Cipher aes = Cipher.getInstance(AES_TRANSFORMATION);
            aes.init(Cipher.ENCRYPT_MODE, contentKey);
            byte[] iv = aes.getIV();
            byte[] ciphertext = aes.doFinal(value.getBytes(StandardCharsets.UTF_8));

            Cipher rsa = Cipher.getInstance(RSA_TRANSFORMATION);
            rsa.init(Cipher.ENCRYPT_MODE, biometricPublicKey(), OAEP_PARAMS);
            byte[] wrappedKey = rsa.doFinal(contentKeyBytes);

            java.util.Arrays.fill(contentKeyBytes, (byte) 0);

            prefs.edit()
                .putString(account + GATED_CT_SUFFIX, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString(account + GATED_IV_SUFFIX, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(account + GATED_KEY_SUFFIX, Base64.encodeToString(wrappedKey, Base64.NO_WRAP))
                .apply();
        } catch (Exception e) {
            throw new RuntimeException("Gated encrypt failed for " + account, e);
        }
    }

    synchronized void deleteGated(String account) {
        prefs.edit()
            .remove(account + GATED_CT_SUFFIX)
            .remove(account + GATED_IV_SUFFIX)
            .remove(account + GATED_KEY_SUFFIX)
            .apply();
    }

    boolean hasGated(String account) {
        return prefs.getString(account + GATED_CT_SUFFIX, null) != null
            && prefs.getString(account + GATED_KEY_SUFFIX, null) != null;
    }

    // ─── Biometric-enabled marker (never prompts) ────────────────────────────

    boolean isBiometricEnabled() {
        return prefs.getBoolean(BIO_ENABLED_MARKER, false);
    }

    void setBiometricEnabled(boolean enabled) {
        prefs.edit().putBoolean(BIO_ENABLED_MARKER, enabled).apply();
    }

    /**
     * An RSA/OAEP DECRYPT Cipher initialized with the biometric-gated private
     * key, ready to be wrapped in a BiometricPrompt.CryptoObject. Using it before
     * a successful prompt throws — that is the whole point.
     *
     * @throws KeyPermanentlyInvalidatedException if biometrics were re-enrolled
     *         (surface as BIOMETRIC_INVALIDATED to JS).
     */
    Cipher gatedUnwrapCipher() throws Exception {
        Cipher rsa = Cipher.getInstance(RSA_TRANSFORMATION);
        rsa.init(Cipher.DECRYPT_MODE, biometricPrivateKey(), OAEP_PARAMS);
        return rsa;
    }

    /**
     * Completes a gated read AFTER BiometricPrompt has authenticated {@code
     * authenticatedUnwrapCipher} (the same Cipher instance handed to the
     * CryptoObject). Unwraps the single content key with the now-usable
     * private-key cipher, then AES-decrypts the combined blob. Returns null when
     * the account has no gated entry.
     */
    synchronized String finishGatedRead(String account, Cipher authenticatedUnwrapCipher) throws Exception {
        String encodedCt = prefs.getString(account + GATED_CT_SUFFIX, null);
        String encodedIv = prefs.getString(account + GATED_IV_SUFFIX, null);
        String encodedKey = prefs.getString(account + GATED_KEY_SUFFIX, null);
        if (encodedCt == null || encodedIv == null || encodedKey == null) {
            return null;
        }
        byte[] wrappedKey = Base64.decode(encodedKey, Base64.NO_WRAP);
        byte[] contentKeyBytes = authenticatedUnwrapCipher.doFinal(wrappedKey);
        try {
            SecretKey contentKey = new SecretKeySpec(contentKeyBytes, KeyProperties.KEY_ALGORITHM_AES);
            byte[] ciphertext = Base64.decode(encodedCt, Base64.NO_WRAP);
            byte[] iv = Base64.decode(encodedIv, Base64.NO_WRAP);
            Cipher aes = Cipher.getInstance(AES_TRANSFORMATION);
            aes.init(Cipher.DECRYPT_MODE, contentKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(aes.doFinal(ciphertext), StandardCharsets.UTF_8);
        } finally {
            java.util.Arrays.fill(contentKeyBytes, (byte) 0);
        }
    }

    // ─── Legacy two-item cleanup ─────────────────────────────────────────────

    /**
     * Deletes the pre-combined two-item layout (both ungated and gated variants
     * of the separate accessToken/refreshToken entries) so stale — and, when
     * gated, biometric-orphaned — blobs never linger after the migration to the
     * single combined item.
     */
    synchronized void deleteLegacy() {
        delete(LEGACY_ACCESS_TOKEN);
        delete(LEGACY_REFRESH_TOKEN);
        deleteGated(LEGACY_ACCESS_TOKEN);
        deleteGated(LEGACY_REFRESH_TOKEN);
    }

    // ─── Keystore keys ───────────────────────────────────────────────────────

    private SecretKey masterKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        return generateMasterKey();
    }

    private SecretKey generateMasterKey() throws Exception {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private PublicKey biometricPublicKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        // Reading the certificate/public key never requires auth. Generate the
        // keypair on first use.
        if (!keyStore.containsAlias(BIO_KEY_ALIAS)) {
            return generateBiometricKeyPair().getPublic();
        }
        return keyStore.getCertificate(BIO_KEY_ALIAS).getPublicKey();
    }

    private PrivateKey biometricPrivateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        KeyStore.Entry entry = keyStore.getEntry(BIO_KEY_ALIAS, null);
        if (entry instanceof KeyStore.PrivateKeyEntry) {
            return ((KeyStore.PrivateKeyEntry) entry).getPrivateKey();
        }
        // Should not happen: writeGated always creates the pair first. If it is
        // missing there is nothing decryptable anyway.
        throw new IllegalStateException("Biometric key pair missing");
    }

    private KeyPair generateBiometricKeyPair() throws Exception {
        KeyPairGenerator generator =
            KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEYSTORE_PROVIDER);
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
            BIO_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(2048)
            // Authorize SHA-1 as well so OAEP with MGF1-SHA1 (OAEP_PARAMS) is permitted.
            .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
            .setUserAuthenticationRequired(true)
            // Drop the key when a new biometric is enrolled — prevents an attacker
            // who can enroll a fingerprint from reaching stored tokens.
            .setInvalidatedByBiometricEnrollment(true);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            // Per-use auth (timeout 0) restricted to strong biometrics.
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            // Pre-API-30: -1 means "authenticate for every use" (per-operation),
            // which BiometricPrompt+CryptoObject satisfies. Strong-only is enforced
            // at prompt time via BIOMETRIC_STRONG in NativeAuthPlugin.
            builder.setUserAuthenticationValidityDurationSeconds(-1);
        }
        generator.initialize(builder.build());
        return generator.generateKeyPair();
    }
}
