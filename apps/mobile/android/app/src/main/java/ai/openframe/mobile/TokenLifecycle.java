package ai.openframe.mobile;

import android.annotation.SuppressLint;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.SystemClock;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.SSLPeerUnverifiedException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.ConnectionPool;
import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
// okhttp3.internal is not stable API (pinned 4.12.0 in variables.gradle) — re-check on every OkHttp bump.
import okhttp3.internal.http2.ErrorCode;
import okhttp3.internal.http2.StreamResetException;
import okio.BufferedSink;

/**
 * Shell-owned token lifecycle: the in-memory pair, the single-flight refresh
 * against the gateway BFF, and the push of every change to the web view. The
 * Android port of ios/App/App/TokenLifecycle.swift — same taxonomy, tunables
 * and custody rules; read that file's header for the why.
 *
 * What differs is the runtime. The Capacitor bridge exists only while
 * MainActivity does, so this is a process singleton the plugin ATTACHES to,
 * and the notification path (a FirebaseMessagingService, a BroadcastReceiver,
 * a Worker) reaches it with no plugin and no web view at all. Every state read
 * and write runs on one single-thread executor — the "store queue" — and the
 * POST runs on OkHttp's own threads with only its outcome coming back onto it.
 *
 * {@code DEVICE_LOCKED} keeps its bridge meaning — "the store cannot be read
 * right now, the session is intact" — but the cause differs: the Keystore
 * master key carries no setUnlockedDeviceRequired and the app is not
 * Direct-Boot aware, so a process only ever runs after the first unlock; what
 * refuses a read here is a Keystore that is briefly unavailable
 * ({@link SecureTokenStore.Unavailable}), and that must never read as absent.
 */
final class TokenLifecycle {

    // ─── Tunables (same values as iOS and desktop) ───────────────────────────

    private static final long REFRESH_MARGIN_MS = 120_000;
    private static final long POLL_INTERVAL_MS = 30_000;
    private static final long[] RETRY_DELAYS_MS = {1_000, 3_000};
    private static final long WALL_CLOCK_BUDGET_MS = 10_000;
    private static final long LOST_ROTATION_COOLDOWN_MS = 60_000;
    /** The claim carrying the user UUID in our own access token ({@code sub} is the email). */
    static final String CLAIM_USER_ID = "userId";

    /** Reject codes the web view sees on refreshTokens; every one maps to "transient" there. */
    static final class Code {
        static final String UNREACHED = "REFRESH_UNREACHED";
        static final String UNKNOWN = "REFRESH_UNKNOWN";
        static final String HELD = "REFRESH_HELD";
        static final String DEVICE_LOCKED = "DEVICE_LOCKED";
        static final String BIOMETRIC_LOCKED = "BIOMETRIC_LOCKED";
        static final String NO_HOST = "NO_HOST";
        static final String SESSION_REPLACED = "SESSION_REPLACED";

        private Code() {
        }
    }

    /** What a refresh call settles as, for the caller. */
    static final class RefreshResult {
        enum Kind { TOKENS, SESSION_OVER, FAILED }

        final Kind kind;
        /** The stored pair after the call — rotated, or already fresh. TOKENS only. */
        final TokenPair pair;
        final String code;
        final String message;

        private RefreshResult(Kind kind, TokenPair pair, String code, String message) {
            this.kind = kind;
            this.pair = pair;
            this.code = code;
            this.message = message;
        }

        static RefreshResult tokens(TokenPair pair) {
            return new RefreshResult(Kind.TOKENS, pair, null, null);
        }

        /** The gateway refused the refresh token, or there was none: custody is dropped. */
        static RefreshResult sessionOver() {
            return new RefreshResult(Kind.SESSION_OVER, null, null, null);
        }

        /** Nothing changed and the stored pair is intact. */
        static RefreshResult failed(String code, String message) {
            return new RefreshResult(Kind.FAILED, null, code, message);
        }
    }

    /** What the plugin's biometric enable gets back from {@link #gate}. */
    enum GateResult { GATED, NOTHING_HELD, WRITE_FAILED }

    /**
     * What one POST to /oauth/refresh settled as. The split between UNREACHED
     * and UNKNOWN is the whole point: retrying a request the gateway never saw
     * costs nothing; retrying one it may have answered re-presents a refresh
     * token the server may already have retired, which comes back as a 401 and
     * reads exactly like a revoked session.
     */
    private static final class Outcome {
        enum Kind { ROTATED, REJECTED, UNREACHED, UNKNOWN }

        final Kind kind;
        final TokenPair pair;
        final String reason;

        private Outcome(Kind kind, TokenPair pair, String reason) {
            this.kind = kind;
            this.pair = pair;
            this.reason = reason;
        }

        static Outcome rotated(TokenPair pair) {
            return new Outcome(Kind.ROTATED, pair, null);
        }

        static Outcome rejected() {
            return new Outcome(Kind.REJECTED, null, null);
        }

        static Outcome unreached(String reason) {
            return new Outcome(Kind.UNREACHED, null, reason);
        }

        static Outcome unknown(String reason) {
            return new Outcome(Kind.UNKNOWN, null, reason);
        }
    }

    /** A caller waiting on the refresh in flight; records the session epoch it joined under — see finish. */
    private static final class Waiter {
        final long epoch;
        final boolean force;
        final String rejectedAccessToken;
        final String trigger;
        final Consumer<RefreshResult> completion;

        Waiter(long epoch, boolean force, String rejectedAccessToken, String trigger, Consumer<RefreshResult> completion) {
            this.epoch = epoch;
            this.force = force;
            this.rejectedAccessToken = rejectedAccessToken;
            this.trigger = trigger;
            this.completion = completion;
        }
    }

    // ─── Singleton ───────────────────────────────────────────────────────────

    // The application context, never an Activity's: nothing to leak.
    @SuppressLint("StaticFieldLeak")
    private static volatile TokenLifecycle instance;

    static TokenLifecycle get(Context context) {
        TokenLifecycle current = instance;
        if (current == null) {
            synchronized (TokenLifecycle.class) {
                current = instance;
                if (current == null) {
                    current = new TokenLifecycle(context.getApplicationContext());
                    instance = current;
                }
            }
        }
        return current;
    }

    private final Context context;
    private final SecureTokenStore store;
    /**
     * The store queue. One thread; every touch of the state below runs on it,
     * and plugin calls (already off the UI thread, on Capacitor's plugin
     * thread) block on a Future exactly as iOS does {@code queue.sync}. Nothing
     * submitted here may ever wait on the main thread.
     */
    private final ScheduledExecutorService queue =
        Executors.newSingleThreadScheduledExecutor(r -> new Thread(r, "token-lifecycle"));
    private final RefreshTransport transport;

    // ─── State (on the queue) ────────────────────────────────────────────────
    // Every private method below runs on the queue, suffix or not; the suffix
    // marks the ones that have a public, sync-wrapped twin.

    /**
     * The pair the process holds. Populated by the first successful read —
     * which, with biometric login on, is the ONE prompt the web view drives at
     * launch — and by every write. Read in preference to the store so a gated
     * store never prompts again for as long as the process lives.
     */
    private TokenPair cache;
    /**
     * Bumped whenever custody changes hands (sign-out, or the web view storing
     * a pair), so a rotation that was in flight can tell the answer it holds
     * belongs to a session that no longer exists.
     */
    private long sessionEpoch;
    /** When the last refresh went out and got no answer back (elapsedRealtime); null once nothing is in doubt. */
    private Long lostRotationAt;
    /** Callers waiting on the refresh in flight; null when none is. */
    private List<Waiter> waiters;
    /** A rotation whose pair could not be written down; memory is the truth meanwhile. */
    private boolean pendingWrite;
    /** A silent read was refused in this process, so the web view may be parked behind its lock with nothing to lift it. */
    private boolean readWasRefused;
    private NativeAuthPlugin plugin;

    // ─── Foreground state ────────────────────────────────────────────────────

    private final AtomicBoolean foreground = new AtomicBoolean(false);
    private ScheduledFuture<?> pollTask;
    private boolean observersInstalled;

    private TokenLifecycle(Context context) {
        this.context = context;
        this.store = new SecureTokenStore(context);
        this.transport = new RefreshTransport();
    }

    /** The dumb store. The plugin drives its biometric primitives around the prompt; policy stays here. */
    SecureTokenStore store() {
        return store;
    }

    // ─── Wiring ──────────────────────────────────────────────────────────────

    /** From OpenFrameApplication.onCreate, on the main thread. Idempotent. */
    void installObservers() {
        if (observersInstalled) {
            return;
        }
        observersInstalled = true;
        ProcessLifecycleOwner.get().getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onStart(@NonNull LifecycleOwner owner) {
                foreground.set(true);
                startPolling();
                queue.execute(() -> {
                    flushPendingWriteLocked();
                    announceIfNewlyReadableLocked();
                    refreshIfStaleLocked("the app came to the foreground");
                });
            }

            @Override
            public void onStop(@NonNull LifecycleOwner owner) {
                foreground.set(false);
                stopPolling();
            }
        });
    }

    /** Whether an Activity of ours is started — what the messaging service asks before posting a banner. */
    boolean isForeground() {
        return foreground.get();
    }

    /**
     * Biometric login on and nothing unlocked in this process: no background
     * handler can read the credential, so a tray button must open the app
     * instead (PushNotifications.addActions).
     */
    boolean isGatedAndUnprimed() {
        return sync(this::gatedAndUnprimedLocked);
    }

    private boolean gatedAndUnprimedLocked() {
        return cache == null && store.isBiometricEnabled();
    }

    /** From the plugin's load(). The plugin never owns the lifecycle; it is the event sink. */
    void attach(NativeAuthPlugin plugin) {
        queue.execute(() -> this.plugin = plugin);
    }

    void detach(NativeAuthPlugin plugin) {
        queue.execute(() -> {
            if (this.plugin == plugin) {
                this.plugin = null;
            }
        });
    }

    private synchronized void startPolling() {
        if (pollTask != null) {
            return;
        }
        // A throw would end the periodic task silently; the poll must outlive one bad tick.
        pollTask = queue.scheduleWithFixedDelay(() -> {
            try {
                refreshIfStaleLocked("the foreground poll");
            } catch (RuntimeException e) {
                ShellLog.auth.error("the foreground poll failed: " + e);
            }
        }, POLL_INTERVAL_MS, POLL_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    private synchronized void stopPolling() {
        if (pollTask != null) {
            pollTask.cancel(false);
            pollTask = null;
        }
    }

    // ─── Reads (for the plugin) ──────────────────────────────────────────────

    /** The pair the process already holds, without touching the store. */
    TokenPair cachedPair() {
        return sync(() -> cache);
    }

    /**
     * Read the ungated item, priming the cache; empty when nothing is stored.
     * Precondition: biometric login is off — a gated item would prompt, which
     * is the plugin's decision to make, not this reader's.
     */
    TokenPair readSilently() {
        return sync(this::readSilentlyLocked);
    }

    /**
     * Taken before a biometric prompt goes up, so what was read through it can
     * be told apart from a session that ended while it was up (a sign-out, a
     * 401): the blob predates that, and must not bring the session back.
     */
    long custodyEpoch() {
        return sync(() -> sessionEpoch);
    }

    /**
     * Adopt a pair the plugin read through the biometric prompt. The cache wins
     * if something populated it meanwhile (a login, a rotation): the prompted
     * read is then the older of the two — and so is a read under an epoch that
     * has since moved on.
     */
    TokenPair adopt(TokenPair promptedRead, long epoch) {
        return sync(() -> {
            adoptLocked(promptedRead, epoch);
            return cache == null ? TokenPair.EMPTY : cache;
        });
    }

    private void adoptLocked(TokenPair pair, long epoch) {
        if (cache == null && sessionEpoch == epoch && !pair.isEmpty()) {
            cache = pair;
        }
    }

    /**
     * The cached pair, else the ungated item (priming the cache); empty when
     * nothing is stored. Throws {@link SecureTokenStore.Unavailable} when the
     * store cannot be read right now — never "empty", which is what ends a session.
     */
    private TokenPair readSilentlyLocked() {
        if (cache != null) {
            return cache;
        }
        TokenPair stored;
        try {
            stored = TokenPair.decode(store.read(SecureTokenStore.COMBINED));
        } catch (SecureTokenStore.Unavailable e) {
            readWasRefused = true;
            ShellLog.auth.error("the token item cannot be read right now (" + e.getCause() + ") — a store outage, not an empty store");
            throw e;
        }
        if (!stored.isEmpty()) {
            cache = stored;
        }
        return stored;
    }

    /**
     * A launch whose silent read was refused left the web view parked behind its
     * lock. The next foreground is a fresh chance: read the pair now and push
     * it, so the web view lifts the gate itself instead of waiting for a tap on
     * a button that promises a biometric it never needed (the iOS twin does the
     * same after a locked-device launch).
     */
    private void announceIfNewlyReadableLocked() {
        if (!readWasRefused || cache != null || store.isBiometricEnabled()) {
            return;
        }
        try {
            TokenPair pair = readSilentlyLocked();
            if (!pair.isEmpty()) {
                readWasRefused = false;
                ShellLog.auth.notice("the token item became readable — pushing the pair to the web view");
                emit(pair);
            }
        } catch (SecureTokenStore.Unavailable ignored) {
            // Still refused; the next foreground tries again.
        }
    }

    // ─── Writes (for the plugin) ─────────────────────────────────────────────

    /**
     * Store a pair the web view hands over (a login). Fields that did not arrive
     * keep their stored value. This is a custody change: whatever rotation is
     * in flight belongs to the pair being replaced, and its answer is dropped.
     * False when the write failed (the pair is held in memory and retried).
     */
    boolean storeLogin(TokenPair incoming) {
        return sync(() -> {
            if (incoming.isEmpty()) {
                return true;
            }
            // With the store gated and nothing cached, the item cannot be read
            // silently — and need not be: the web view sends the full pair.
            TokenPair merged;
            try {
                merged = gatedAndUnprimedLocked() ? TokenPair.EMPTY : readSilentlyLocked();
            } catch (SecureTokenStore.Unavailable e) {
                // A login overwrites whatever is stored; nothing to merge over.
                merged = TokenPair.EMPTY;
            }
            String previousRefresh = merged.refresh;
            merged = merged.merge(incoming);
            sessionEpoch++;
            boolean replacedRefresh = incoming.refresh != null && !incoming.refresh.equals(previousRefresh);
            ShellLog.auth.notice("the web view stored a pair (access: " + (incoming.access != null)
                + ", refresh: " + (incoming.refresh != null) + ", replaced refresh: " + replacedRefresh + ")");
            // A refresh token this side never presented settles any doubt exactly
            // as a rotation does — conditional on it actually changing, so the
            // web view re-saving the pair it just read cannot clear a doubt that
            // stands.
            if (replacedRefresh) {
                lostRotationAt = null;
            }
            cache = merged;
            boolean written = writeLocked(merged, store.isBiometricEnabled());
            store.deleteLegacy();
            return written;
        });
    }

    /**
     * Re-store the held pair gated and turn the marker on — the plugin's
     * biometric enable, after its consent prompt. The pair the process holds,
     * not a re-read of the blob: a rotation may have landed while the sheet
     * was up, and a write still pending means the blob is behind. Nothing held
     * is nothing to gate. A failed write leaves the marker off and the pair
     * held for the next flush.
     */
    GateResult gate() {
        return sync(() -> {
            if (cache == null) {
                return GateResult.NOTHING_HELD;
            }
            if (!writeLocked(cache, true)) {
                return GateResult.WRITE_FAILED;
            }
            store.setBiometricEnabled(true);
            store.delete(SecureTokenStore.COMBINED);
            return GateResult.GATED;
        });
    }

    /**
     * The other direction — the plugin's biometric disable, after its prompted
     * read. The held pair is re-stored ungated and the marker dropped. The read
     * is the user's consent and, under an unchanged epoch, the fallback for a
     * process holding nothing; it is never the first choice, since the blob
     * read before the sheet went up may predate a rotation. Nothing to write
     * means no session: the item goes, so the marker never reads "ungated"
     * over a gated blob. A failed write leaves the marker on and the pair held
     * for the next flush, which then rewrites it gated.
     */
    boolean ungate(TokenPair promptedRead, long epoch) {
        return sync(() -> {
            adoptLocked(promptedRead, epoch);
            if (cache != null) {
                if (!writeLocked(cache, false)) {
                    return false;
                }
            } else {
                store.delete(SecureTokenStore.COMBINED);
            }
            store.setBiometricEnabled(false);
            store.deleteGated(SecureTokenStore.COMBINED);
            return true;
        });
    }

    /** Drop custody: cache, both stored copies, biometric marker. The next login starts clean and ungated. */
    void endSession() {
        sync(() -> {
            endSessionLocked();
            return null;
        });
    }

    private void endSessionLocked() {
        ShellLog.auth.notice("custody dropped — cache, stored item and biometric marker cleared");
        cache = null;
        pendingWrite = false;
        // The doubt belonged to the token being deleted.
        lostRotationAt = null;
        store.delete(SecureTokenStore.COMBINED);
        store.deleteGated(SecureTokenStore.COMBINED);
        store.deleteLegacy();
        store.setBiometricEnabled(false);
        // After the delete, never before: a rotation already past its own
        // snapshot would otherwise see an unchanged epoch and write it back.
        sessionEpoch++;
    }

    /** The one writer of the item; memory is the truth until a write lands, and {@code pendingWrite} says so. */
    private boolean writeLocked(TokenPair pair, boolean gated) {
        try {
            if (gated) {
                store.writeGated(SecureTokenStore.COMBINED, pair.encode());
            } else {
                store.write(SecureTokenStore.COMBINED, pair.encode());
            }
            pendingWrite = false;
            return true;
        } catch (RuntimeException e) {
            ShellLog.auth.error("the pair could not be written down (" + e.getMessage() + ") — holding it in memory");
            pendingWrite = true;
            return false;
        }
    }

    private void flushPendingWriteLocked() {
        if (!pendingWrite || cache == null) {
            return;
        }
        if (writeLocked(cache, store.isBiometricEnabled())) {
            ShellLog.auth.notice("wrote down the pair held in memory");
        }
    }

    // ─── Hosts ───────────────────────────────────────────────────────────────

    /**
     * Persist the login-learned tenant origin. https only, and never taken from
     * anything but the web view's own login result. The chat endpoints a
     * notification action calls live only there.
     */
    boolean setTenantHost(String origin) {
        String normalized = httpsOrigin(origin);
        if (normalized == null) {
            return false;
        }
        store.putPlain(SecureTokenStore.TENANT_HOST, normalized);
        return true;
    }

    /**
     * Persist the shared auth host the web view itself refreshes against — the
     * refresh base for a build with no baked host. Not the tenant host, and
     * never a fallback to it: the tenant host is a DIFFERENT gateway, whose BFF
     * only puts the rotated pair in the Access-Token/Refresh-Token headers when
     * its own mobile-auth-enabled flag is on. A refresh sent there can succeed
     * server-side and come back as a 204 without the tokens — the refresh token
     * then rotated into cookies this side discards, and the next refresh is a
     * 401 that ends the session. Observed on stage 2026-09-09.
     */
    boolean setSharedHost(String origin) {
        String normalized = httpsOrigin(origin);
        if (normalized == null) {
            return false;
        }
        store.putPlain(SecureTokenStore.SHARED_HOST, normalized);
        return true;
    }

    /** The tenant origin the web view learned at login, or null before any login. */
    String learnedTenantHost() {
        return httpsOrigin(store.getPlain(SecureTokenStore.TENANT_HOST));
    }

    /** Where /oauth/refresh lives: the build-baked shared auth host, else the one the web view pushed. */
    private String refreshBase() {
        String baked = httpsOrigin(BuildConfig.OPENFRAME_SHARED_HOST_URL);
        if (baked != null) {
            return baked;
        }
        return httpsOrigin(store.getPlain(SecureTokenStore.SHARED_HOST));
    }

    /** The scheme + host (+ port) of an https URL, or null for anything else. */
    private static String httpsOrigin(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        Uri uri = Uri.parse(trimmed);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (scheme == null || !scheme.equalsIgnoreCase("https") || host == null || host.isEmpty()) {
            return null;
        }
        int port = uri.getPort();
        return "https://" + host.toLowerCase(Locale.ROOT) + (port > 0 ? ":" + port : "");
    }

    // ─── Refresh ─────────────────────────────────────────────────────────────

    /**
     * Refresh on the web view's behalf. {@code rejectedAccessToken} is the token
     * the gateway just refused; when the stored one already differs, a rotation
     * beat this caller and no request goes out. Null forces a rotation.
     */
    void refresh(String rejectedAccessToken, Consumer<RefreshResult> completion) {
        queue.execute(() -> refreshLocked(true, rejectedAccessToken, "the web view", completion));
    }

    /**
     * The pair to act with on the user's behalf — a notification action —
     * refreshed first when the access token is missing or expiring. Never
     * prompts: a background caller has nothing to prompt with, and a gated
     * store the process has not unlocked yet is reported as BIOMETRIC_LOCKED.
     */
    void ensureFresh(String trigger, Consumer<RefreshResult> completion) {
        queue.execute(() -> refreshLocked(false, null, trigger, completion));
    }

    private void refreshIfStaleLocked(String trigger) {
        refreshLocked(false, null, trigger, ignored -> { });
    }

    private void refreshLocked(boolean force, String rejectedAccessToken, String trigger, Consumer<RefreshResult> completion) {
        // Join the flight in progress: its answer is newer than anything this
        // caller could obtain by rotating again.
        if (waiters != null) {
            waiters.add(new Waiter(sessionEpoch, force, rejectedAccessToken, trigger, completion));
            return;
        }
        if (gatedAndUnprimedLocked()) {
            // Gated and unread. The web view's launch read is what prompts; until
            // it has, a refresh cannot be started — and must not be reported as a
            // dead session, which the web view would answer by wiping the store
            // and turning biometric login off.
            completion.accept(RefreshResult.failed(Code.BIOMETRIC_LOCKED,
                "the tokens are biometric-gated and have not been unlocked yet"));
            return;
        }
        // Empty when nothing is stored at all — the one case that IS signed out.
        TokenPair current;
        try {
            current = readSilentlyLocked();
        } catch (SecureTokenStore.Unavailable e) {
            // The same answer for the same reason as a locked device on iOS: the
            // session is intact; say so, never "over".
            completion.accept(RefreshResult.failed(Code.DEVICE_LOCKED, "the stored tokens cannot be read right now"));
            return;
        }
        if (current.refresh == null) {
            if (force) {
                ShellLog.auth.error("no refresh token to present — reporting the session over (access present: "
                    + (current.access != null) + ", trigger: " + trigger + ")");
            }
            completion.accept(force ? RefreshResult.sessionOver() : RefreshResult.tokens(current));
            return;
        }
        if (force) {
            // A rotation beat the caller: answered from the pair held, no POST.
            // Only with an access token to hand back — the web view reads a
            // result without one as the session being over.
            if (rejectedAccessToken != null && current.access != null && !current.access.equals(rejectedAccessToken)) {
                completion.accept(RefreshResult.tokens(current));
                return;
            }
        } else if (!needsRefresh(current)) {
            completion.accept(RefreshResult.tokens(current));
            return;
        }
        if (lostRotationAt != null) {
            long left = LOST_ROTATION_COOLDOWN_MS - (SystemClock.elapsedRealtime() - lostRotationAt);
            if (left > 0) {
                ShellLog.auth.notice("refresh held back for " + ((left + 999) / 1000)
                    + "s — a rotation's fate is still unknown (trigger: " + trigger + ")");
                completion.accept(RefreshResult.failed(Code.HELD, "a rotation with an unknown outcome is still cooling down"));
                return;
            }
        }
        String base = refreshBase();
        if (base == null) {
            ShellLog.auth.error("no shared host to refresh against — pass -PofSharedHostUrl "
                + "(NEXT_PUBLIC_SHARED_HOST_URL) to the build, "
                + "or the web view pushes one at hydration (trigger: " + trigger + ")");
            completion.accept(RefreshResult.failed(Code.NO_HOST, "no host configured for token refresh"));
            return;
        }

        long epoch = sessionEpoch;
        waiters = new ArrayList<>();
        waiters.add(new Waiter(epoch, force, rejectedAccessToken, trigger, completion));
        ShellLog.auth.notice("refreshing (trigger: " + trigger + ", base: " + Uri.parse(base).getHost() + ")");
        attempt(0, base, current.refresh, epoch, trigger);
    }

    private void attempt(int index, String base, String refreshToken, long epoch, String trigger) {
        try {
            post(index, base, refreshToken, epoch, trigger);
        } catch (RuntimeException e) {
            // An attempt that never got off the ground must still settle, or every
            // later caller joins the flight forever and the web view's promise
            // hangs. Nothing was presented to the gateway, so it is unreached.
            ShellLog.auth.error("the refresh could not be started: " + e);
            finish(Outcome.unreached("the refresh could not be started: " + e.getMessage()), epoch, trigger);
        }
    }

    private void post(int index, String base, String refreshToken, long epoch, String trigger) {
        transport.post(base, refreshToken, outcome -> queue.execute(() -> {
            if (outcome.kind == Outcome.Kind.UNREACHED && index < RETRY_DELAYS_MS.length) {
                long delay = RETRY_DELAYS_MS[index];
                ShellLog.auth.notice("refresh never reached " + Uri.parse(base).getHost() + " (" + outcome.reason
                    + ") — retrying in " + (delay / 1000) + "s");
                queue.schedule(() -> {
                    // A sign-out while waiting: do not present its token again.
                    if (sessionEpoch != epoch) {
                        finish(outcome, epoch, trigger);
                        return;
                    }
                    attempt(index + 1, base, refreshToken, epoch, trigger);
                }, delay, TimeUnit.MILLISECONDS);
                return;
            }
            finish(outcome, epoch, trigger);
        }));
    }

    private void finish(Outcome outcome, long epoch, String trigger) {
        // The waiters are taken before anything that could throw: a flight left
        // non-null would be joined by every later caller and never settle, with
        // the executor swallowing the exception that caused it.
        List<Waiter> pending = waiters == null ? new ArrayList<>() : waiters;
        waiters = null;
        RefreshResult result;
        try {
            result = settle(outcome, epoch, trigger);
        } catch (RuntimeException e) {
            ShellLog.auth.error("the refresh could not be settled: " + e);
            result = RefreshResult.failed(Code.UNKNOWN, "the refresh could not be settled: " + e.getMessage());
        }
        for (Waiter waiter : pending) {
            if (waiter.epoch == epoch) {
                waiter.completion.accept(result);
            } else {
                // Joined after custody changed hands — a login stored a new pair
                // while this flight was out. Its answer is about a pair the
                // caller never held, so re-evaluate against the current one:
                // usually answered without a request, since the pair is fresh.
                refreshLocked(waiter.force, waiter.rejectedAccessToken, waiter.trigger, waiter.completion);
            }
        }
    }

    private RefreshResult settle(Outcome outcome, long epoch, String trigger) {
        // Custody changed hands while this was on the wire — a sign-out, or a
        // fresh login. Either way the answer is about a pair that is gone: a
        // rotation must not be written over the new pair, and a rejection must
        // not clear it.
        if (sessionEpoch != epoch) {
            ShellLog.auth.notice("a refresh settled after the session it belonged to ended — dropping it (trigger: "
                + trigger + ")");
            return RefreshResult.failed(Code.SESSION_REPLACED, "the session changed while the refresh was in flight");
        }
        switch (outcome.kind) {
            case ROTATED: {
                TokenPair merged = (cache == null ? TokenPair.EMPTY : cache).merge(outcome.pair);
                cache = merged;
                // Whatever an earlier lost rotation did, the pair now held is one
                // the gateway just issued: nothing is in doubt any more.
                lostRotationAt = null;
                // The gateway has already rotated, so the refresh token on disk is
                // spent whether or not this write lands. Memory is the truth; a
                // failed write is retried on the next foreground.
                writeLocked(merged, store.isBiometricEnabled());
                Long exp = merged.access == null ? null : jwtExpiry(merged.access);
                ShellLog.auth.notice("refreshed (trigger: " + trigger + ", access exp: " + (exp == null ? "?" : exp) + ")");
                emit(merged);
                return RefreshResult.tokens(merged);
            }
            case REJECTED: {
                ShellLog.auth.error("the gateway answered 401 to the refresh (trigger: " + trigger + ")");
                String why = lostRotationAt != null
                    ? "a refresh whose response was lost had already rotated it"
                    : "the gateway rejected the refresh token";
                ShellLog.auth.notice("session over (" + why + ") on a refresh (trigger: " + trigger + ") — clearing stored tokens");
                endSessionLocked();
                emit(TokenPair.EMPTY);
                return RefreshResult.sessionOver();
            }
            case UNREACHED:
                return RefreshResult.failed(Code.UNREACHED, outcome.reason);
            case UNKNOWN:
            default:
                // Stamped on every loss, not just the first: each unanswered POST
                // is itself newly in doubt.
                lostRotationAt = SystemClock.elapsedRealtime();
                ShellLog.auth.notice("refresh went out with no usable answer (" + outcome.reason + ") — holding the token back for "
                    + (LOST_ROTATION_COOLDOWN_MS / 1000) + "s (trigger: " + trigger + ")");
                return RefreshResult.failed(Code.UNKNOWN, outcome.reason);
        }
    }

    /**
     * Push the stored set to the web view — the full pair after a rotation, an
     * empty set when the session is over — so its cache mirrors what the shell
     * did while it was idle. Same event contract as iOS and the desktop shell.
     */
    private void emit(TokenPair pair) {
        NativeAuthPlugin sink = plugin;
        if (sink != null) {
            sink.emitTokenUpdate(pair.toJS());
        }
    }

    // ─── Freshness ───────────────────────────────────────────────────────────

    private static boolean needsRefresh(TokenPair pair) {
        if (pair.refresh == null) {
            return false;
        }
        if (pair.access == null) {
            return true;
        }
        // An `exp` that cannot be read is not a schedule — the 401 path owns it.
        Long exp = jwtExpiry(pair.access);
        if (exp == null) {
            return false;
        }
        return System.currentTimeMillis() + REFRESH_MARGIN_MS >= exp;
    }

    /** {@code exp} of a JWT as epoch milliseconds, decoded without signature verification — a scheduling hint about our own token. */
    static Long jwtExpiry(String token) {
        JSONObject payload = jwtPayload(token);
        if (payload == null || !payload.has("exp")) {
            return null;
        }
        long exp = payload.optLong("exp", 0);
        return exp > 0 ? exp * 1000 : null;
    }

    /** A string claim of our own access token, e.g. {@code userId} (the user UUID; {@code sub} is the email). */
    static String jwtClaim(String token, String claim) {
        JSONObject payload = jwtPayload(token);
        if (payload == null) {
            return null;
        }
        String value = payload.optString(claim, null);
        return value == null || value.isEmpty() ? null : value;
    }

    private static JSONObject jwtPayload(String token) {
        String[] parts = token.split("\\.");
        if (parts.length < 2) {
            return null;
        }
        try {
            byte[] decoded = Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            return new JSONObject(new String(decoded, StandardCharsets.UTF_8));
        } catch (RuntimeException | JSONException e) {
            return null;
        }
    }

    // ─── Queue plumbing ──────────────────────────────────────────────────────

    private <T> T sync(Callable<T> body) {
        try {
            return queue.submit(body).get();
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException) {
                throw (RuntimeException) cause;
            }
            throw new IllegalStateException(cause);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while waiting for the token lifecycle", e);
        }
    }

    // ─── Transport ───────────────────────────────────────────────────────────

    /**
     * The refresh POST and its classification into an Outcome. Its own client
     * with NO ambient credentials — see the OkHttp note in app/build.gradle —
     * and a wall-clock deadline on elapsedRealtime: OkHttp's own timers run on
     * the monotonic clock, which does not advance while the device sleeps, and
     * a POST the app slept through would otherwise hold the single flight for
     * as long as the sleep lasted.
     */
    private final class RefreshTransport {
        private final OkHttpClient client = credentialFreeClient(WALL_CLOCK_BUDGET_MS);

        void post(String base, String refreshToken, Consumer<Outcome> completion) {
            // A request that never left the device is the one outcome that is
            // safe to retry; the framework can say so definitively before the
            // socket is even opened.
            ConnectivityManager connectivity = context.getSystemService(ConnectivityManager.class);
            if (connectivity != null && connectivity.getActiveNetwork() == null) {
                completion.accept(Outcome.unreached("no network path"));
                return;
            }
            Request request = new Request.Builder()
                .url(base + "/oauth/refresh")
                .header("Refresh-Token", refreshToken)
                .header("Accept", "application/json")
                // A body, deliberately: some front ends answer a Content-Length-less
                // POST with 411 before the gateway sees it (found on desktop). The
                // BFF takes no request body, so an empty object is ignored. No
                // tenantId query param: the BFF resolves the tenant from the token,
                // and a bare UUID in the URL trips the WAF.
                .post(jsonBody("{}"))
                .build();
            Call call = client.newCall(request);
            Flight flight = new Flight(completion);
            long startedAt = SystemClock.elapsedRealtime();
            call.enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    flight.settle(classifyFailure(e, flight));
                }

                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) {
                    try (response) {
                        flight.settle(classifyResponse(response));
                    }
                }
            });
            // The wall-clock deadline. Fires late after a sleep — which is fine:
            // whichever of it and the completion settles the flight first wins.
            queue.schedule(() -> {
                if (SystemClock.elapsedRealtime() - startedAt < WALL_CLOCK_BUDGET_MS) {
                    return;
                }
                if (flight.markCancelled("refresh outlived its " + (WALL_CLOCK_BUDGET_MS / 1000) + "s wall-clock budget")) {
                    call.cancel();
                }
            }, WALL_CLOCK_BUDGET_MS + 500, TimeUnit.MILLISECONDS);
        }

        private Outcome classifyFailure(IOException e, Flight flight) {
            String cancelReason = flight.cancelReason();
            if (cancelReason != null) {
                return Outcome.unknown(cancelReason);
            }
            // Everything that ends before the request is on the wire: DNS, the
            // connect, the TLS handshake. Anything else — a connection lost
            // mid-answer, a timeout — means the gateway may well have rotated.
            if (e instanceof UnknownHostException || e instanceof ConnectException || e instanceof NoRouteToHostException
                || e instanceof SSLHandshakeException || e instanceof SSLPeerUnverifiedException) {
                return Outcome.unreached(describe(e));
            }
            if (e instanceof SocketTimeoutException
                && String.valueOf(e.getMessage()).toLowerCase(Locale.ROOT).contains("connect")) {
                return Outcome.unreached(describe(e));
            }
            // The one post-send failure that guarantees the server did not
            // process the stream (RFC 9113 §8.7) — a routine drain race behind an
            // h2 load balancer, which the one-shot body stops OkHttp from retrying.
            if (e instanceof StreamResetException
                && ((StreamResetException) e).errorCode == ErrorCode.REFUSED_STREAM) {
                return Outcome.unreached(describe(e));
            }
            if (e instanceof InterruptedIOException) {
                return Outcome.unknown("refresh timed out");
            }
            return Outcome.unknown(describe(e));
        }

        private Outcome classifyResponse(Response response) {
            int status = response.code();
            if (response.isSuccessful()) {
                TokenPair rotated = rotatedPair(response);
                if (rotated != null) {
                    return Outcome.rotated(rotated);
                }
                return Outcome.unknown("refresh returned no token headers — is mobile auth enabled on the gateway?");
            }
            if (status == 401) {
                return Outcome.rejected();
            }
            // Answered, so a rotation is not ruled out: a 5xx from a front end
            // can sit in front of a gateway that already did the work. A 403 is
            // deliberately NOT a rejection — the BFF never answers one on this
            // endpoint, so it is the WAF's, and says nothing about the credential.
            return Outcome.unknown("refresh failed: HTTP " + status);
        }

        /**
         * The rotated pair a refresh response carries. The Access-Token /
         * Refresh-Token headers are the bearer-mode contract, but the BFF only
         * adds them when its own mobile-auth-enabled (or dev-ticket-enabled)
         * flag is on — and it sets the SAME pair as cookies on every success.
         * So the cookies are read as the fallback; the client stores none, so
         * they exist only as response headers here and go nowhere else.
         */
        private TokenPair rotatedPair(Response response) {
            TokenPair fromHeaders = TokenPair.fromHeaders(response);
            if (!fromHeaders.isEmpty()) {
                return fromHeaders;
            }
            String access = null;
            String refresh = null;
            for (Cookie cookie : Cookie.parseAll(response.request().url(), response.headers())) {
                if (cookie.name().equals("access_token")) {
                    access = cookie.value();
                } else if (cookie.name().equals("refresh_token")) {
                    refresh = cookie.value();
                }
            }
            TokenPair fromCookies = new TokenPair(access, refresh);
            return fromCookies.isEmpty() ? null : fromCookies;
        }

        private String describe(IOException e) {
            String message = e.getMessage();
            return e.getClass().getSimpleName() + (message == null ? "" : ": " + message);
        }
    }

    /** One POST's bookkeeping: settled exactly once, by the response, the failure, or the deadline. */
    private static final class Flight {
        private final Consumer<Outcome> completion;
        private boolean settled;
        private String cancelReason;

        Flight(Consumer<Outcome> completion) {
            this.completion = completion;
        }

        synchronized boolean markCancelled(String reason) {
            if (settled) {
                return false;
            }
            cancelReason = reason;
            return true;
        }

        synchronized String cancelReason() {
            return cancelReason;
        }

        void settle(Outcome outcome) {
            synchronized (this) {
                if (settled) {
                    return;
                }
                settled = true;
            }
            completion.accept(outcome);
        }
    }

    /**
     * Every client the shell opens to a gateway carries NO ambient credentials:
     * no cookie jar (Capacitor bridges the process default to the WebView's,
     * whose auth cookies would otherwise ride along and be preferred by the
     * BFF over the header), no redirects, and the caller's timeouts. Pair it with
     * {@link #jsonBody}: OkHttp keeps its own connect-phase route retries
     * (exactly the "unreached" class), and the one-shot body is what stops it
     * from re-sending a POST whose body was already written.
     */
    static OkHttpClient credentialFreeClient(long timeoutMs) {
        // No redirects: OkHttp strips only Authorization on a cross-host hop, so a
        // 30x would carry the Refresh-Token header to whatever Location names — a
        // 3xx here is an unknown outcome, not a route. Connect gets a shorter
        // budget than the call, so a black-hole network fails as a connect timeout
        // (never left the device) before the call watchdog reads as unknown.
        // No keep-alive either: a pooled connection gone half-open across a
        // radio transition "sends" successfully and fails on the read, which
        // would file a request the gateway never saw as unknown. A fresh
        // connection per call costs nothing at these rates.
        return new OkHttpClient.Builder()
            .cookieJar(CookieJar.NO_COOKIES)
            .connectionPool(new ConnectionPool(0, 1, TimeUnit.SECONDS))
            .followRedirects(false)
            .followSslRedirects(false)
            .connectTimeout(Math.min(5_000, timeoutMs / 2), TimeUnit.MILLISECONDS)
            .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
            .writeTimeout(timeoutMs, TimeUnit.MILLISECONDS)
            .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
            .build();
    }

    /**
     * A JSON body OkHttp will send exactly once. With a plain
     * {@code RequestBody.create} the client transparently re-sends a POST after
     * a "recoverable" failure — a reset, an EOF mid-response, a stale pooled
     * connection — when another route exists, below anything the caller sees.
     * For a refresh that is a second presentation of a token the gateway may
     * already have rotated (a 401 that reads as a revoked session); for an
     * action it is a reply delivered twice. One-shot keeps the classification
     * here as the only retry policy.
     */
    static RequestBody jsonBody(String json) {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        return new RequestBody() {
            @Override
            public MediaType contentType() {
                return MediaType.get("application/json");
            }

            @Override
            public long contentLength() {
                return bytes.length;
            }

            @Override
            public void writeTo(@NonNull BufferedSink sink) throws IOException {
                sink.write(bytes);
            }

            @Override
            public boolean isOneShot() {
                return true;
            }
        };
    }
}
