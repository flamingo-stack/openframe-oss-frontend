package ai.openframe.mobile;

import android.content.Intent;
import android.net.Uri;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.view.View;
import android.view.WindowInsets;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.graphics.Insets;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

import javax.crypto.Cipher;

/**
 * Android port of the iOS NativeAuthPlugin (ios/App/App/NativeAuthPlugin.swift).
 * Same jsName ("NativeAuth") and JS contract, so the frontend
 * (openframe-frontend: src/lib/native-shell.ts) works unchanged.
 *
 * - start: OAuth login in a Chrome Custom Tab (the RFC 8252 Android equivalent of
 *   iOS's ASWebAuthenticationSession — a real system browser, NOT a WebView, which
 *   third-party IdPs like Google refuse). The gateway 302s the devTicket to the
 *   custom scheme com.openframe.app://auth; the deep-link intent-filter on
 *   MainActivity (launchMode=singleTask) routes it back to onNewIntent, which the
 *   Capacitor bridge forwards to handleOnNewIntent here. callbackHost/callbackPath
 *   arrive from JS for the desktop shell's benefit; Android ignores them (mirrors iOS).
 * - exchangeTicket: dev-ticket -> tokens over native HTTP, reading the
 *   Access-Token / Refresh-Token RESPONSE headers (no CORS, mirrors iOS).
 * - get/set/clearTokens: Android-Keystore-backed secure storage (SecureTokenStore),
 *   device-bound with no cloud backup (mirrors iOS Keychain WhenUnlockedThisDeviceOnly).
 * - getSafeAreaInsets: real insets from WindowInsets (the WebView reports
 *   env(safe-area-inset-*) as 0 in the shell, same as iOS WKWebView).
 *
 * Prototype dev-ticket path — no PKCE yet (backend-gated). Replicates the iOS
 * plugin's current behavior; no new auth logic.
 */
@CapacitorPlugin(name = "NativeAuth")
public class NativeAuthPlugin extends Plugin {

    private static final String CALLBACK_SCHEME = "com.openframe.app";
    private static final String CALLBACK_HOST = "auth";

    private final ExecutorService io = Executors.newSingleThreadExecutor();

    // The single in-flight login call, resolved when the deep link returns or
    // rejected if another login re-enters (mirrors iOS's ALREADY_PRESENTING guard).
    private PluginCall pendingLoginCall;

    // ─── Safe-area insets ────────────────────────────────────────────────────

    @PluginMethod
    public void getSafeAreaInsets(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Insets insets = Insets.NONE;
            View decor = getActivity().getWindow() != null ? getActivity().getWindow().getDecorView() : null;
            if (decor != null) {
                WindowInsets raw = decor.getRootWindowInsets();
                if (raw != null) {
                    insets = WindowInsetsCompat.toWindowInsetsCompat(raw)
                        .getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                }
            }
            // WindowInsets is px; the frontend sets CSS px vars from these, matching
            // iOS which returns UIKit points (1:1 with CSS px). density-independent
            // conversion is intentionally omitted to keep the contract identical.
            float density = getContext().getResources().getDisplayMetrics().density;
            JSObject result = new JSObject();
            result.put("top", insets.top / density);
            result.put("bottom", insets.bottom / density);
            result.put("left", insets.left / density);
            result.put("right", insets.right / density);
            call.resolve(result);
        });
    }

    // ─── Login ───────────────────────────────────────────────────────────────

    @PluginMethod
    public void start(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("Missing or invalid 'url'");
            return;
        }
        Uri url = Uri.parse(urlString);

        synchronized (this) {
            if (pendingLoginCall != null) {
                call.reject("A sign-in session is already open", "ALREADY_PRESENTING");
                return;
            }
            // Save so handleOnNewIntent can resolve/reject it across the browser round-trip.
            bridge.saveCall(call);
            pendingLoginCall = call;
        }

        getActivity().runOnUiThread(() -> {
            try {
                CustomTabsIntent tab = new CustomTabsIntent.Builder().build();
                // Keep the redirect landing in our task rather than the browser task.
                tab.intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                tab.launchUrl(getContext(), url);
            } catch (Exception e) {
                clearPendingLogin();
                call.reject("Could not start the sign-in session: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        Uri data = intent.getData();
        if (data == null) {
            return;
        }
        if (!CALLBACK_SCHEME.equals(data.getScheme()) || !CALLBACK_HOST.equals(data.getHost())) {
            return;
        }
        PluginCall call = pendingLoginCall;
        if (call == null) {
            return;
        }
        clearPendingLogin();
        JSObject result = new JSObject();
        result.put("callbackUrl", data.toString());
        call.resolve(result);
    }

    // A Custom Tab dismissed by the user (back / close) resumes this activity WITHOUT
    // delivering a deep link. On the success path onNewIntent runs first and has
    // already cleared pendingLoginCall, so a still-pending call here means the user
    // abandoned login — mirror iOS's USER_CANCELED so the JS side stops waiting.
    // (Launching the tab produces onPause, not onResume, so there is no spurious
    // first-resume to filter out.)
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        PluginCall call = pendingLoginCall;
        if (call != null) {
            clearPendingLogin();
            call.reject("USER_CANCELED", "USER_CANCELED");
        }
    }

    private synchronized void clearPendingLogin() {
        if (pendingLoginCall != null) {
            bridge.releaseCall(pendingLoginCall);
            pendingLoginCall = null;
        }
    }

    // ─── Dev-ticket exchange ─────────────────────────────────────────────────

    @PluginMethod
    public void exchangeTicket(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("Missing or invalid 'url'");
            return;
        }
        io.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlString);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Accept", "application/json");
                conn.setInstanceFollowRedirects(true);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("Ticket exchange failed with status " + status);
                    return;
                }
                JSObject result = new JSObject();
                String accessToken = conn.getHeaderField("Access-Token");
                if (accessToken != null) {
                    result.put("accessToken", accessToken);
                }
                String refreshToken = conn.getHeaderField("Refresh-Token");
                if (refreshToken != null) {
                    result.put("refreshToken", refreshToken);
                }
                call.resolve(result);
            } catch (IOException e) {
                call.reject("Ticket exchange failed: " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    // ─── Keystore-backed token storage ───────────────────────────────────────

    private SecureTokenStore store;

    // Synchronized so the lazy init can't race: the returned instance is also
    // the MONITOR for the compound setTokens/enable/disable swaps, and two
    // threads observing different instances would defeat that mutual exclusion.
    private synchronized SecureTokenStore store() {
        if (store == null) {
            store = new SecureTokenStore(getContext());
        }
        return store;
    }

    @PluginMethod
    public void getTokens(PluginCall call) {
        if (!store().isBiometricEnabled()) {
            // Ungated path — silent single-blob read, no prompt.
            String blob = store().read(SecureTokenStore.COMBINED);
            call.resolve(pairResult(blob));
            return;
        }
        // Gated path — ONE BiometricPrompt unlocks the private key that unwraps
        // the single content key, then the combined blob is parsed into both
        // tokens. Prompt on the UI thread with the bridge Activity.
        authenticateAndReadGated(call);
    }

    // Builds the {accessToken?, refreshToken?} JS result from a combined JSON blob.
    private JSObject pairResult(String blob) {
        JSObject result = new JSObject();
        String accessToken = SecureTokenStore.pairField(blob, "accessToken");
        if (accessToken != null) {
            result.put("accessToken", accessToken);
        }
        String refreshToken = SecureTokenStore.pairField(blob, "refreshToken");
        if (refreshToken != null) {
            result.put("refreshToken", refreshToken);
        }
        return result;
    }

    // One shared executor for every BiometricPrompt's callbacks — a per-prompt
    // newSingleThreadExecutor() leaks its never-shut-down thread.
    private final Executor bioExecutor = Executors.newSingleThreadExecutor();

    /**
     * Shared BiometricPrompt plumbing for the three gated flows (read / enable /
     * disable). Presents ONE BIOMETRIC_STRONG prompt wired to {@code unwrapCipher}
     * on the UI thread (BiometricPrompt needs a FragmentActivity; BridgeActivity
     * is one). On success the authenticated cipher goes to {@code onAuthenticated},
     * which owns its own error handling and call resolution. Every non-success
     * terminal — prompt error (cancel, timeout, lockout: all collapse to
     * BIOMETRIC_CANCELED for the JS side, mirroring iOS), a missing CryptoObject
     * cipher, or a failure to present — runs {@code onErrorCleanup} (nullable)
     * before rejecting, so flows with staged state (enable's gated copy) can
     * roll back in one place.
     */
    private void promptBiometric(PluginCall call, Cipher unwrapCipher, String title, String subtitle,
                                 Runnable onErrorCleanup, Consumer<Cipher> onAuthenticated) {
        getActivity().runOnUiThread(() -> {
            FragmentActivity activity = getActivity();
            BiometricPrompt prompt = new BiometricPrompt(
                activity,
                bioExecutor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        if (onErrorCleanup != null) {
                            onErrorCleanup.run();
                        }
                        call.reject(errString != null ? errString.toString() : "Biometric canceled", "BIOMETRIC_CANCELED");
                    }

                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authResult) {
                        Cipher authenticated = authResult.getCryptoObject() != null
                            ? authResult.getCryptoObject().getCipher() : null;
                        if (authenticated == null) {
                            if (onErrorCleanup != null) {
                                onErrorCleanup.run();
                            }
                            call.reject("Biometric result missing cipher", "BIOMETRIC_CANCELED");
                            return;
                        }
                        onAuthenticated.accept(authenticated);
                    }

                    // onAuthenticationFailed (a single non-matching sample) is not
                    // terminal — the prompt stays up; no call resolution here.
                });

            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setNegativeButtonText("Cancel")
                .build();

            try {
                prompt.authenticate(info, new BiometricPrompt.CryptoObject(unwrapCipher));
            } catch (Exception e) {
                if (onErrorCleanup != null) {
                    onErrorCleanup.run();
                }
                call.reject("Could not present biometric prompt: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            }
        });
    }

    // A single BiometricPrompt authenticates the RSA-decrypt Cipher; after
    // success the ONE gated content key unwraps under it and the combined blob
    // is parsed into both tokens.
    private void authenticateAndReadGated(PluginCall call) {
        final Cipher unwrapCipher;
        try {
            unwrapCipher = store().gatedUnwrapCipher();
        } catch (KeyPermanentlyInvalidatedException e) {
            call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            return;
        } catch (Exception e) {
            call.reject("Could not prepare biometric read: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            return;
        }

        promptBiometric(call, unwrapCipher, "Unlock OpenFrame", "Authenticate to access your account", null, authenticated -> {
            try {
                String blob = store().finishGatedRead(SecureTokenStore.COMBINED, authenticated);
                call.resolve(pairResult(blob));
            } catch (KeyPermanentlyInvalidatedException e) {
                // No state reset here: the frontend reacts with forceLogout →
                // clearTokens, which wipes both copies and the marker.
                call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            } catch (Exception e) {
                call.reject("Gated token read failed: " + e.getMessage(), "BIOMETRIC_CANCELED");
            }
        });
    }

    @PluginMethod
    public void setTokens(PluginCall call) {
        // The frontend token-store always sends the full current pair, so the
        // combined blob is written whole — no read-modify-write, no gated read on
        // write. Absent fields are omitted from the blob.
        String accessToken = call.getData().has("accessToken") ? call.getString("accessToken") : null;
        String refreshToken = call.getData().has("refreshToken") ? call.getString("refreshToken") : null;
        try {
            // The marker check + write must be one unit: enable's success
            // callback flips the marker and swaps copies under the same lock,
            // so a rotation landing mid-enable can't write into the mode that
            // was just retired (store methods are individually synchronized;
            // this compound isn't without the explicit block).
            synchronized (store()) {
                if (accessToken == null && refreshToken == null) {
                    // Nothing to store — clear the combined item in the active mode.
                    if (store().isBiometricEnabled()) {
                        store().deleteGated(SecureTokenStore.COMBINED);
                    } else {
                        store().delete(SecureTokenStore.COMBINED);
                    }
                } else {
                    String blob = SecureTokenStore.encodePair(accessToken, refreshToken);
                    if (store().isBiometricEnabled()) {
                        store().writeGated(SecureTokenStore.COMBINED, blob);
                    } else {
                        store().write(SecureTokenStore.COMBINED, blob);
                    }
                }
            }
            // Drop any leftover legacy two-item entries from older installs.
            store().deleteLegacy();
            call.resolve();
        } catch (Exception e) {
            call.reject("Secure token write failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearTokens(PluginCall call) {
        store().delete(SecureTokenStore.COMBINED);
        store().deleteGated(SecureTokenStore.COMBINED);
        store().deleteLegacy();
        store().setBiometricEnabled(false);
        call.resolve();
    }

    // ─── Biometric gating ────────────────────────────────────────────────────

    @PluginMethod
    public void isBiometricAvailable(PluginCall call) {
        int status = BiometricManager.from(getContext())
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        boolean available = status == BiometricManager.BIOMETRIC_SUCCESS;
        JSObject result = new JSObject();
        result.put("available", available);
        // Android can't reliably tell face from fingerprint pre-API-30; the
        // BiometricManager gives no modality breakdown. Default to "fingerprint"
        // whenever a strong biometric is enrolled (matches the contract).
        result.put("biometryType", available ? "fingerprint" : "none");
        call.resolve(result);
    }

    @PluginMethod
    public void isBiometricLoginEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", store().isBiometricEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void enableBiometricLogin(PluginCall call) {
        int status = BiometricManager.from(getContext())
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("Biometric authentication is not available", "BIOMETRIC_UNAVAILABLE");
            return;
        }
        final String blob = store().read(SecureTokenStore.COMBINED);
        if (blob == null) {
            call.reject("No tokens to protect", "NO_TOKENS");
            return;
        }
        // Write the gated copy (silent — public-key wrap), then make the user's
        // opt-in prompt VERIFY it: the single BiometricPrompt both confirms the
        // user right when they enable and exercises the full wrap→unwrap round
        // trip, so a crypto/provider mismatch fails here — not at the next cold
        // start after the ungated copy is already gone.
        // Not enabled on any failure: drop the gated copy, keep the ungated one.
        Runnable dropGated = () -> store().deleteGated(SecureTokenStore.COMBINED);
        final Cipher unwrapCipher;
        try {
            // Fresh enable = fresh keypair bound to the current enrollment; an
            // invalidated leftover keypair still wraps silently but can never
            // decrypt again (see SecureTokenStore.resetBiometricKey).
            store().resetBiometricKey();
            store().writeGated(SecureTokenStore.COMBINED, blob);
            unwrapCipher = store().gatedUnwrapCipher();
        } catch (Exception e) {
            dropGated.run();
            call.reject("Could not enable biometric login: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            return;
        }

        promptBiometric(call, unwrapCipher, "Enable biometric login", "Confirm it's you", dropGated, authenticated -> {
            try {
                String verified = store().finishGatedRead(SecureTokenStore.COMBINED, authenticated);
                if (verified == null) {
                    throw new IllegalStateException("gated blob missing after write");
                }
                // The pair may have rotated (or been cleared) while the prompt
                // was up — re-wrap the latest blob (silent) so gating never
                // winds the session back, and never gate a session that ended
                // mid-prompt. The whole read→re-wrap→marker→delete swap holds
                // the store lock so a concurrent setTokens rotation lands
                // either fully before (fresh read sees it) or fully after
                // (marker on → it writes gated).
                synchronized (store()) {
                    String fresh = store().read(SecureTokenStore.COMBINED);
                    if (fresh == null) {
                        dropGated.run();
                        call.reject("No tokens to protect", "NO_TOKENS");
                        return;
                    }
                    if (!fresh.equals(blob)) {
                        store().writeGated(SecureTokenStore.COMBINED, fresh);
                    }
                    store().setBiometricEnabled(true);
                    store().delete(SecureTokenStore.COMBINED);
                }
                call.resolve();
            } catch (Exception e) {
                dropGated.run();
                call.reject("Could not enable biometric login: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            }
        });
    }

    @PluginMethod
    public void disableBiometricLogin(PluginCall call) {
        if (!store().isBiometricEnabled()) {
            call.resolve();
            return;
        }
        // Reading gated tokens prompts; then re-store ungated and clear the marker.
        final Cipher unwrapCipher;
        try {
            unwrapCipher = store().gatedUnwrapCipher();
        } catch (KeyPermanentlyInvalidatedException e) {
            // Enrollment change killed the key — the tokens are unrecoverable
            // either way, so return to a clean ungated state instead of leaving
            // the marker pointing at an undecryptable blob; the frontend reacts
            // to INVALIDATED with a forced re-login.
            store().deleteGated(SecureTokenStore.COMBINED);
            store().setBiometricEnabled(false);
            call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            return;
        } catch (Exception e) {
            call.reject("Could not prepare biometric read: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            return;
        }

        promptBiometric(call, unwrapCipher, "Disable biometric login", "Authenticate to continue", null, authenticated -> {
            try {
                // Same lock as enable's swap, and the gated read is INSIDE it:
                // a rotation landing after the read but before the marker flip
                // would write gated and then be destroyed by deleteGated,
                // winding the session back to the pre-rotation blob.
                synchronized (store()) {
                    String blob = store().finishGatedRead(SecureTokenStore.COMBINED, authenticated);
                    if (blob != null) {
                        store().write(SecureTokenStore.COMBINED, blob);
                    }
                    store().setBiometricEnabled(false);
                    store().deleteGated(SecureTokenStore.COMBINED);
                }
                call.resolve();
            } catch (KeyPermanentlyInvalidatedException e) {
                store().deleteGated(SecureTokenStore.COMBINED);
                store().setBiometricEnabled(false);
                call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            } catch (Exception e) {
                call.reject("Could not disable biometric login: " + e.getMessage(), "BIOMETRIC_CANCELED");
            }
        });
    }
}
