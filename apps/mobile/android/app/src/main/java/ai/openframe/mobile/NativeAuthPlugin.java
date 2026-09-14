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
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

import javax.crypto.Cipher;

import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

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
 *   Capacitor bridge forwards to handleOnNewIntent here.
 * - exchangeTicket: dev-ticket -> tokens over native HTTP, reading the
 *   Access-Token / Refresh-Token RESPONSE headers (no CORS, mirrors iOS).
 * - get/set/clearTokens, refreshTokens, setTenantHost, the tokenUpdate event: the
 *   bridge onto {@link TokenLifecycle}, which owns the in-memory pair, the
 *   single-flight refresh and the hosts. This plugin only drives what needs an
 *   Activity — the biometric prompts — and hands the result to the lifecycle.
 * - getSafeAreaInsets: real insets from WindowInsets (the WebView reports
 *   env(safe-area-inset-*) as 0 in the shell, same as iOS WKWebView).
 */
@CapacitorPlugin(name = "NativeAuth")
public class NativeAuthPlugin extends Plugin {

    private static final String CALLBACK_SCHEME = "com.openframe.app";
    private static final String CALLBACK_HOST = "auth";
    private static final long EXCHANGE_TIMEOUT_MS = 15_000;
    /** The one endpoint exchangeTicket exists to call; the host varies per deployment, the path does not. */
    private static final String EXCHANGE_PATH = "/oauth/dev-exchange";
    private static final String INVALID_URL = "Missing or invalid 'url'";
    /** No ambient credentials on the exchange either: see TokenLifecycle.credentialFreeClient. */
    private static final OkHttpClient exchangeClient = TokenLifecycle.credentialFreeClient(EXCHANGE_TIMEOUT_MS);

    private final ExecutorService io = Executors.newSingleThreadExecutor();

    // The single in-flight login call, resolved when the deep link returns or
    // rejected if another login re-enters (mirrors iOS's ALREADY_PRESENTING guard).
    private PluginCall pendingLoginCall;

    private TokenLifecycle lifecycle;

    @Override
    public void load() {
        lifecycle = TokenLifecycle.get(getContext());
        lifecycle.attach(this);
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        // The web view goes with the Activity; a rotation after this must not
        // try to reach it through a dead plugin.
        lifecycle.detach(this);
    }

    /** The lifecycle's channel to the web view: the full stored set after every change. */
    void emitTokenUpdate(JSObject tokens) {
        notifyListeners("tokenUpdate", tokens, false);
    }

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
            call.reject(INVALID_URL);
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
            call.reject(INVALID_URL);
            return;
        }
        // The same guard as the iOS twin: https, and the PATH pinned — the bridge
        // hands the response's token headers to page script, so it must not be
        // a "fetch any URL" primitive. Vetted on the parse the request is built
        // from (a guard on another parser's reading of the string enforces
        // nothing), and collapsed before comparing: a configured host with a
        // trailing slash yields `//oauth/...`.
        HttpUrl url = HttpUrl.parse(urlString);
        if (url == null) {
            call.reject(INVALID_URL);
            return;
        }
        if (!url.isHttps() || !EXCHANGE_PATH.equals(url.encodedPath().replaceAll("/+", "/"))) {
            call.reject("Refusing to exchange a ticket at that URL", "URL_NOT_ALLOWED");
            return;
        }
        Request request = new Request.Builder().url(url).header("Accept", "application/json").get().build();
        io.execute(() -> {
            try (Response response = exchangeClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    call.reject("Ticket exchange failed with status " + response.code());
                    return;
                }
                call.resolve(TokenPair.fromHeaders(response).toJS());
            } catch (IOException e) {
                call.reject("Ticket exchange failed: " + e.getMessage());
            }
        });
    }

    // ─── Tokens (through the lifecycle) ──────────────────────────────────────

    @PluginMethod
    public void getTokens(PluginCall call) {
        if (!lifecycle.store().isBiometricEnabled()) {
            try {
                call.resolve(lifecycle.readSilently().toJS());
            } catch (SecureTokenStore.Unavailable e) {
                // The frontend treats DEVICE_LOCKED as a retryable lock and leaves
                // the store alone; the lifecycle pushes the pair once a later
                // read succeeds. Resolving empty here would read as signed out.
                call.reject("The stored tokens cannot be read right now", TokenLifecycle.Code.DEVICE_LOCKED);
            }
            return;
        }
        // The pair the process holds answers first: re-hydration (a post-login
        // navigation, an unlock retry) must never prompt again — the store is
        // read through the prompt exactly once per process, below.
        TokenPair cached = lifecycle.cachedPair();
        if (cached != null) {
            call.resolve(cached.toJS());
            return;
        }
        // Gated path — ONE BiometricPrompt unlocks the private key that unwraps
        // the single content key, then the combined blob is parsed into both
        // tokens. The epoch is taken before the sheet goes up so a session that
        // ends while it is up is not brought back by the blob read through it.
        long epoch = lifecycle.custodyEpoch();
        final Cipher unwrapCipher;
        try {
            unwrapCipher = lifecycle.store().gatedUnwrapCipher();
        } catch (KeyPermanentlyInvalidatedException e) {
            call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            return;
        } catch (Exception e) {
            call.reject("Could not prepare biometric read: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            return;
        }
        promptBiometric(call, unwrapCipher, "Unlock OpenFrame", "Authenticate to access your account", null, authenticated -> {
            try {
                String blob = lifecycle.store().finishGatedRead(SecureTokenStore.COMBINED, authenticated);
                call.resolve(lifecycle.adopt(TokenPair.decode(blob), epoch).toJS());
            } catch (KeyPermanentlyInvalidatedException e) {
                // No state reset here: the frontend reacts with forceLogout →
                // clearTokens, which drops custody.
                call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            } catch (Exception e) {
                call.reject("Gated token read failed: " + e.getMessage(), "BIOMETRIC_CANCELED");
            }
        });
    }

    @PluginMethod
    public void setTokens(PluginCall call) {
        // A login result. The lifecycle merges it over what it holds, writes the
        // full pair as ONE item (gated per the marker; no gated read-modify-write,
        // so the write stays silent), and treats it as a custody change so a
        // rotation still in flight for the previous pair cannot land on top.
        TokenPair incoming = new TokenPair(call.getString(TokenPair.ACCESS_KEY), call.getString(TokenPair.REFRESH_KEY));
        if (lifecycle.storeLogin(incoming)) {
            call.resolve();
        } else {
            call.reject("Secure token write failed");
        }
    }

    @PluginMethod
    public void clearTokens(PluginCall call) {
        lifecycle.endSession();
        call.resolve();
    }

    /**
     * Shell-owned refresh — its presence is what makes the web view stop
     * refreshing on its own. Resolves the stored pair after the attempt, an
     * EMPTY object only when the session is over (the web view answers that by
     * clearing its tokens and turning biometric login off), and REJECTS on
     * everything that keeps the session: unreached, unknown, held, gated,
     * no host, replaced. See TokenLifecycle.Code.
     */
    @PluginMethod
    public void refreshTokens(PluginCall call) {
        String rejected = call.getString("rejectedAccessToken");
        lifecycle.refresh(rejected, result -> {
            switch (result.kind) {
                case TOKENS:
                    call.resolve(result.pair.toJS());
                    break;
                case SESSION_OVER:
                    call.resolve(new JSObject());
                    break;
                case FAILED:
                default:
                    call.reject(result.message, result.code);
                    break;
            }
        });
    }

    /**
     * The hosts the web view knows: {@code origin}, the tenant gateway learned at
     * login (where a notification action's chat calls go), and {@code sharedOrigin},
     * the shared auth host the web view refreshes against — the refresher's
     * base when the build carries none. Never the other way round: see
     * TokenLifecycle.setSharedHost for why the tenant host must not refresh.
     */
    @PluginMethod
    public void setTenantHost(PluginCall call) {
        String origin = call.getString("origin");
        if (origin == null || !lifecycle.setTenantHost(origin)) {
            call.reject("Refusing a tenant host that is not an https origin", "URL_NOT_ALLOWED");
            return;
        }
        String shared = call.getString("sharedOrigin");
        if (shared != null && !shared.isEmpty() && !lifecycle.setSharedHost(shared)) {
            call.reject("Refusing a shared host that is not an https origin", "URL_NOT_ALLOWED");
            return;
        }
        call.resolve();
    }

    // ─── Biometric gating ────────────────────────────────────────────────────

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
        result.put("enabled", lifecycle.store().isBiometricEnabled());
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
        if (lifecycle.store().isBiometricEnabled()) {
            call.resolve();
            return;
        }
        // The pair the process holds (primed silently — the marker is off), not a
        // re-read of the blob: a write still pending means the blob is behind.
        TokenPair pair = lifecycle.readSilently();
        if (pair.isEmpty()) {
            call.reject("No tokens to protect", "NO_TOKENS");
            return;
        }
        // Stage a gated copy (silent — public-key wrap), then make the user's
        // opt-in prompt VERIFY it: the single BiometricPrompt both confirms the
        // user right when they enable and exercises the full wrap→unwrap round
        // trip, so a crypto/provider mismatch fails here — not at the next cold
        // start after the ungated copy is already gone.
        // Not enabled on any failure: drop the gated copy, keep the ungated one.
        Runnable dropGated = () -> lifecycle.store().deleteGated(SecureTokenStore.COMBINED);
        final Cipher unwrapCipher;
        try {
            // Fresh enable = fresh keypair bound to the current enrollment; an
            // invalidated leftover keypair still wraps silently but can never
            // decrypt again (see SecureTokenStore.resetBiometricKey).
            lifecycle.store().resetBiometricKey();
            lifecycle.store().writeGated(SecureTokenStore.COMBINED, pair.encode());
            unwrapCipher = lifecycle.store().gatedUnwrapCipher();
        } catch (Exception e) {
            dropGated.run();
            call.reject("Could not enable biometric login: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            return;
        }

        promptBiometric(call, unwrapCipher, "Enable biometric login", "Confirm it's you", dropGated, authenticated -> {
            try {
                String verified = lifecycle.store().finishGatedRead(SecureTokenStore.COMBINED, authenticated);
                if (verified == null) {
                    throw new IllegalStateException("gated blob missing after write");
                }
                // The pair the process holds AFTER the prompt, gated on the store
                // queue, then the marker: a rotation may have landed while the
                // sheet was up, and gating the pre-prompt copy would wind the
                // session back; a session that ended mid-prompt is not gated at all.
                switch (lifecycle.gate()) {
                    case GATED:
                        call.resolve();
                        break;
                    case NOTHING_HELD:
                        dropGated.run();
                        call.reject("No tokens to protect", "NO_TOKENS");
                        break;
                    case WRITE_FAILED:
                    default:
                        dropGated.run();
                        call.reject("Could not enable biometric login: the pair could not be re-stored", "BIOMETRIC_UNAVAILABLE");
                        break;
                }
            } catch (Exception e) {
                dropGated.run();
                call.reject("Could not enable biometric login: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            }
        });
    }

    @PluginMethod
    public void disableBiometricLogin(PluginCall call) {
        if (!lifecycle.store().isBiometricEnabled()) {
            call.resolve();
            return;
        }
        long epoch = lifecycle.custodyEpoch();
        final Cipher unwrapCipher;
        try {
            unwrapCipher = lifecycle.store().gatedUnwrapCipher();
        } catch (KeyPermanentlyInvalidatedException e) {
            // Enrollment change killed the key — the tokens are unrecoverable
            // either way, so return to a clean ungated state instead of leaving
            // the marker pointing at an undecryptable blob; the frontend reacts
            // to INVALIDATED with a forced re-login.
            lifecycle.endSession();
            call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            return;
        } catch (Exception e) {
            call.reject("Could not prepare biometric read: " + e.getMessage(), "BIOMETRIC_UNAVAILABLE");
            return;
        }

        promptBiometric(call, unwrapCipher, "Disable biometric login", "Authenticate to continue", null, authenticated -> {
            try {
                // The prompt was the consent; the pair the process holds NOW is
                // what gets re-stored, the blob read through it only a fallback
                // under an unchanged epoch (see TokenLifecycle.ungate).
                String blob = lifecycle.store().finishGatedRead(SecureTokenStore.COMBINED, authenticated);
                if (lifecycle.ungate(TokenPair.decode(blob), epoch)) {
                    call.resolve();
                } else {
                    call.reject("Could not disable biometric login: the pair could not be re-stored", "BIOMETRIC_UNAVAILABLE");
                }
            } catch (KeyPermanentlyInvalidatedException e) {
                lifecycle.endSession();
                call.reject("Biometric enrollment changed", "BIOMETRIC_INVALIDATED");
            } catch (Exception e) {
                call.reject("Could not disable biometric login: " + e.getMessage(), "BIOMETRIC_CANCELED");
            }
        });
    }
}
