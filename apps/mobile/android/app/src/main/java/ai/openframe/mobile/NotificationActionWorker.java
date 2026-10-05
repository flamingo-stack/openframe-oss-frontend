package ai.openframe.mobile;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * Completes one tray action with no web view: the credential from
 * {@link TokenLifecycle#ensureFresh} (the pair the process holds, refreshed
 * first if stale, never a prompt), one POST to the TENANT host, and exactly one
 * outcome written back over the notification. The mapping — which HTTP status
 * says what, which failures keep the buttons — is NotificationActions.swift's
 * {@code act} and {@code report}, copied, not re-derived.
 */
public class NotificationActionWorker extends Worker {

    private static final long SESSION_WAIT_SECONDS = 45;
    private static final long REQUEST_TIMEOUT_MS = 10_000;
    /** An id goes into a URL path: nothing but an identifier may. */
    private static final Pattern ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{1,128}$");
    /**
     * WorkManager is at-least-once: a run the system stops after the POST went
     * out is run again, and a reply sent twice starts a second Mingo turn (an
     * approval re-run is absorbed by the gateway's 409). So a reply records
     * that it was attempted before it goes out, and a re-run finding the record
     * reports instead of re-sending. Ids are unique per push; entries older
     * than a day are pruned on write.
     */
    private static final String LEDGER_PREFS = "ai.openframe.mobile.actions";
    private static final long LEDGER_TTL_MS = 24L * 60 * 60 * 1000;
    private static final int GATEWAY_MESSAGE_LIMIT = 200;
    private static final String REASON_UNREACHABLE = "OpenFrame could not be reached";

    /** One client for every press: a Worker is instantiated per run. */
    private static final OkHttpClient client = TokenLifecycle.credentialFreeClient(REQUEST_TIMEOUT_MS);

    public NotificationActionWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public ForegroundInfo getForegroundInfo() {
        // Expedited work runs as a foreground service below API 31.
        return new ForegroundInfo(PushNotifications.FOREGROUND_ID,
            PushNotifications.foregroundWork(getApplicationContext()).build());
    }

    @NonNull
    @Override
    public Result doWork() {
        Map<String, String> extras = new HashMap<>();
        for (Map.Entry<String, Object> entry : getInputData().getKeyValueMap().entrySet()) {
            if (entry.getValue() instanceof String) {
                extras.put(entry.getKey(), (String) entry.getValue());
            }
        }
        String actionId = extras.remove(NotificationActionReceiver.INPUT_ACTION);
        String reply = extras.remove(NotificationActionReceiver.INPUT_REPLY);
        String notificationId = extras.get(PushNotifications.EXTRA_NOTIFICATION_ID);
        if (actionId == null || notificationId == null) {
            return Result.failure();
        }
        Action action = new Action(actionId, reply);
        Context context = getApplicationContext();
        try {
            act(this, context, action, notificationId, extras);
        } catch (RuntimeException e) {
            // Whatever broke, the spinner the receiver posted must not be the last word.
            ShellLog.notifications.error("could not " + action.verb() + ": " + e);
            failure(context, action, notificationId, extras, "something went wrong");
        }
        return Result.success();
    }

    private static void act(Worker worker, Context context, Action action, String notificationId,
                            Map<String, String> extras) {
        TokenLifecycle lifecycle = TokenLifecycle.get(context);
        TokenLifecycle.RefreshResult session;
        try {
            CompletableFuture<TokenLifecycle.RefreshResult> pending = new CompletableFuture<>();
            lifecycle.ensureFresh("a notification action", pending::complete);
            session = pending.get(SESSION_WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException | ExecutionException | InterruptedException e) {
            // WorkManager never interrupts doWork, and an outcome must still be
            // posted if it ever did — so no interrupt is re-asserted here, where
            // the outcome path itself blocks on the lifecycle's queue.
            session = TokenLifecycle.RefreshResult.failed(TokenLifecycle.Code.UNKNOWN, "timed out waiting for the session");
        }

        TokenPair pair;
        switch (session.kind) {
            case TOKENS:
                pair = session.pair;
                break;
            case SESSION_OVER:
                signInFeedback(context, action, notificationId, extras);
                return;
            case FAILED:
            default:
                if (TokenLifecycle.Code.BIOMETRIC_LOCKED.equals(session.code)) {
                    // Cold process, gated store: the marker flipped after the
                    // notification was built with background buttons. Say so;
                    // the tap opens the app, whose launch read prompts.
                    PushNotifications.replace(context, notificationId, extras,
                        "Open OpenFrame to " + action.verb(), "Unlock OpenFrame to " + action.verb() + "." + action.echo(),
                        false, null);
                    return;
                }
                ShellLog.notifications.error("could not " + action.verb() + ": no usable session (" + session.code + ")");
                failure(context, action, notificationId, extras, sessionFailureReason(session.code, session.message));
                return;
        }
        String access = pair.access;
        if (access == null || !stillLive(access)) {
            signInFeedback(context, action, notificationId, extras);
            return;
        }
        // The session, not the notification, is the authority. A push that names
        // its recipient must be answered by that account — a banner can outlive
        // a sign-out and a different sign-in. A token whose userId cannot be
        // read does not get the benefit of the doubt.
        String recipient = extras.get(PushNotifications.KEY_RECIPIENT_USER_ID);
        if (recipient != null && !recipient.isEmpty()
            && !recipient.equals(TokenLifecycle.jwtClaim(access, TokenLifecycle.CLAIM_USER_ID))) {
            PushNotifications.replace(context, notificationId, extras, extras.get(PushNotifications.KEY_TITLE),
                "This notification belongs to a different account." + action.echo(), false, null);
            return;
        }
        String base = lifecycle.learnedTenantHost();
        if (base == null) {
            PushNotifications.replace(context, notificationId, extras, "Open OpenFrame to " + action.verb(),
                "This install has not learned its gateway yet — open OpenFrame once, then try again." + action.echo(),
                true, action.reply);
            return;
        }
        Request request = request(action, extras, base, access);
        if (request == null) {
            ShellLog.notifications.notice("the notification carries no id the action needs");
            PushNotifications.replace(context, notificationId, extras, extras.get(PushNotifications.KEY_TITLE),
                "This notification carries nothing to " + action.verb() + "." + action.echo(), false, null);
            return;
        }
        if (action.isReply()) {
            if (wasAttempted(context, notificationId)) {
                ShellLog.notifications.error("a reply on " + notificationId + " was already attempted — not re-sending");
                PushNotifications.replace(context, notificationId, extras, extras.get(PushNotifications.KEY_TITLE),
                    "Could not confirm that your reply was sent — open OpenFrame to check." + action.echo(), false, null);
                return;
            }
            markAttempted(context, notificationId);
        }
        if (worker.isStopped()) {
            // Stopped before the request went out: this run will be re-run, and
            // the re-run must not find the reply ledger armed.
            clearAttempted(context, notificationId);
            return;
        }
        try (Response response = client.newCall(request).execute()) {
            report(context, action, notificationId, extras, response);
        } catch (IOException e) {
            ShellLog.notifications.error("could not " + action.verb() + ": " + e.getMessage());
            failure(context, action, notificationId, extras, REASON_UNREACHABLE);
        }
        clearAttempted(context, notificationId);
    }

    private static boolean wasAttempted(Context context, String notificationId) {
        return ledger(context).contains(notificationId);
    }

    // commit, not apply: the record must be on disk before the POST leaves, or a
    // process death in between re-sends on the re-run.
    @SuppressLint("ApplySharedPref")
    private static void markAttempted(Context context, String notificationId) {
        SharedPreferences ledger = ledger(context);
        SharedPreferences.Editor editor = ledger.edit();
        long now = System.currentTimeMillis();
        for (Map.Entry<String, ?> entry : ledger.getAll().entrySet()) {
            if (entry.getValue() instanceof Long && now - (Long) entry.getValue() > LEDGER_TTL_MS) {
                editor.remove(entry.getKey());
            }
        }
        editor.putLong(notificationId, now).commit();
    }

    private static void clearAttempted(Context context, String notificationId) {
        ledger(context).edit().remove(notificationId).apply();
    }

    private static SharedPreferences ledger(Context context) {
        return context.getSharedPreferences(LEDGER_PREFS, Context.MODE_PRIVATE);
    }

    // ─── Requests ────────────────────────────────────────────────────────────

    /** Built on the learned origin, never from payload text: the id is an opaque path segment of a fixed base. */
    private static Request request(Action action, Map<String, String> extras, String base, String bearer) {
        String path;
        JSONObject body = new JSONObject();
        try {
            if (action.isReply()) {
                String id = validId(extras.get(PushNotifications.KEY_DIALOG_ID));
                if (id == null) {
                    return null;
                }
                path = "/chat/api/v1/messages";
                // Static, not inferred: both specs behind MINGO_REPLY sit behind
                // the same `chatType == ADMIN_AI_CHAT` guard server-side.
                body.put("dialogId", id).put("content", action.reply).put("chatType", "ADMIN_AI_CHAT");
            } else {
                String id = validId(extras.get(PushNotifications.KEY_APPROVAL_REQUEST_ID));
                if (id == null) {
                    return null;
                }
                path = "/chat/api/v1/approval-requests/" + id + "/approve";
                body.put("approve", action.isApprove());
            }
        } catch (JSONException e) {
            return null;
        }
        return new Request.Builder()
            .url(base + path)
            .header("Authorization", "Bearer " + bearer)
            .header("Accept", "application/json")
            .post(TokenLifecycle.jsonBody(body.toString()))
            .build();
    }

    private static String validId(String id) {
        return id != null && ID_PATTERN.matcher(id).matches() ? id : null;
    }

    // ─── Outcomes ────────────────────────────────────────────────────────────

    private static void report(Context context, Action action, String notificationId, Map<String, String> extras,
                               Response response) {
        int status = response.code();
        GatewayError gateway = gatewayError(response.body());
        ShellLog.notifications.notice(action.verb() + ": HTTP " + status + " " + (gateway.code == null ? "" : gateway.code));
        if (response.isSuccessful()) {
            String body;
            if (action.isReply()) {
                body = action.reply;
            } else {
                String pushBody = extras.get(PushNotifications.KEY_BODY);
                body = pushBody == null || pushBody.isEmpty() ? extras.get(PushNotifications.KEY_TITLE) : pushBody;
            }
            PushNotifications.replace(context, notificationId, extras, action.done(), body, false, null);
        } else if (status == 401) {
            signInFeedback(context, action, notificationId, extras);
        } else if (status == 404) {
            PushNotifications.replace(context, notificationId, extras, "No longer available",
                "This " + (action.isReply() ? "conversation" : "request") + " no longer exists.", false, null);
        } else if (status == 409 && "DIALOG_LOCKED".equals(gateway.code)) {
            PushNotifications.replace(context, notificationId, extras, "Mingo is busy",
                "Mingo is still working on this conversation. Try again in a moment." + action.echo(), true, action.reply);
        } else if (status == 409 && !action.isReply()) {
            // `ILLEGAL_STATE` covers already-processed, a non-writable dialog and
            // direct mode alike; the gateway's own message names which. Not a
            // failed press: the decision it asked for has been made.
            PushNotifications.replace(context, notificationId, extras, "Already handled",
                gateway.message != null ? gateway.message : "This request was already resolved or is no longer open.", false, null);
        } else {
            failure(context, action, notificationId, extras, gateway.message != null ? gateway.message : "HTTP " + status);
        }
    }

    /** A press that did not go through, with the buttons still there to retry. */
    private static void failure(Context context, Action action, String notificationId, Map<String, String> extras, String reason) {
        PushNotifications.replace(context, notificationId, extras, extras.get(PushNotifications.KEY_TITLE),
            "Could not " + action.verb() + " — " + reason + "." + action.echo(), true, action.reply);
    }

    private static void signInFeedback(Context context, Action action, String notificationId, Map<String, String> extras) {
        PushNotifications.replace(context, notificationId, extras, "Sign in to OpenFrame",
            "Your session has ended. Open OpenFrame and sign in to " + action.verb() + "." + action.echo(), false, null);
    }

    private static String sessionFailureReason(String code, String message) {
        switch (code) {
            case TokenLifecycle.Code.UNREACHED:
                return REASON_UNREACHABLE;
            case TokenLifecycle.Code.NO_HOST:
                return "this install has not learned its gateway yet";
            case TokenLifecycle.Code.UNKNOWN:
            case TokenLifecycle.Code.HELD:
                return "the session could not be refreshed just now";
            default:
                return message;
        }
    }

    /** Never a failure the request did not cause: an {@code exp} that cannot be read counts as live, and the gateway's 401 owns it. */
    private static boolean stillLive(String access) {
        Long exp = TokenLifecycle.jwtExpiry(access);
        return exp == null || exp > System.currentTimeMillis();
    }

    /** The gateway's ErrorResponse: a machine {@code code} and a human {@code message}. */
    private static GatewayError gatewayError(ResponseBody body) {
        if (body == null) {
            return new GatewayError(null, null);
        }
        try {
            String text = body.string();
            if (text.isEmpty()) {
                return new GatewayError(null, null);
            }
            JSONObject json = new JSONObject(text);
            String message = json.optString("message", "").trim();
            return new GatewayError(json.optString("code", null),
                message.isEmpty() ? null : PushNotifications.clip(message, GATEWAY_MESSAGE_LIMIT));
        } catch (IOException | JSONException e) {
            return new GatewayError(null, null);
        }
    }

    private static final class GatewayError {
        final String code;
        final String message;

        GatewayError(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    private static final class Action {
        final String id;
        /** The typed text of a reply; null otherwise. */
        final String reply;

        Action(String id, String reply) {
            this.id = id;
            this.reply = reply;
        }

        boolean isReply() {
            return PushNotifications.ACTION_REPLY.equals(id);
        }

        boolean isApprove() {
            return PushNotifications.ACTION_APPROVE.equals(id);
        }

        String done() {
            if (isApprove()) {
                return "Approved";
            }
            return isReply() ? "Reply sent" : "Rejected";
        }

        String verb() {
            if (isApprove()) {
                return "approve";
            }
            return isReply() ? "send the reply" : "reject";
        }

        /** A failed reply carries the text back: responding to the notification cleared the inline field. */
        String echo() {
            return isReply() && reply != null ? " Your reply: " + reply : "";
        }
    }
}
