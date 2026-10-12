package ai.openframe.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.StringRes;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.PendingIntentCompat;
import androidx.core.app.RemoteInput;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.HashMap;
import java.util.Map;

/**
 * The tray notifications the shell renders itself, for the backend's data-only
 * Android payload (AndroidDataOnlyPushFormatter: no notification block; the
 * title, body, group and category ride as data keys). The Android twin of
 * ios/App/App/NotificationActions.swift's registration and outcome halves.
 *
 * Identity is {@code tag = notificationId, id = 0} — the same the FCM SDK gives
 * the baseline arm's tray entry (AndroidNotification.tag) — so one cancel
 * retracts both kinds, and an outcome REPLACES the push it answers: Android does
 * not dismiss a notification on an action the way iOS does.
 *
 * The content intent carries {@code google.message_id} plus every data key as
 * String extras: that is exactly what the Firebase plugin's handleOnNewIntent
 * keys on to emit the web view's tap event, so the deep link works unchanged.
 */
final class PushNotifications {

    /** The server's category values — ApplePushCategories.java, as the {@code pushCategory} data key. */
    static final String CATEGORY_APPROVAL = "APPROVAL_REQUEST";
    static final String CATEGORY_REPLY = "MINGO_REPLY";
    /** Ours. The web view never sees these: their intents end in NotificationActionReceiver. */
    static final String ACTION_APPROVE = "of.approve";
    static final String ACTION_REJECT = "of.reject";
    static final String ACTION_REPLY = "of.reply";
    /** The RemoteInput result key for the inline reply. */
    static final String EXTRA_REPLY_TEXT = "of.replyText";
    /** Extras on our own intents, alongside the payload's data keys. */
    static final String EXTRA_NOTIFICATION_ID = "of.notificationId";
    static final String EXTRA_MESSAGE_ID = "google.message_id";

    /** Data keys of the data-only payload (FcmPushSender / AndroidDataOnlyPushFormatter). */
    static final String KEY_NOTIFICATION_ID = "notificationId";
    static final String KEY_TITLE = "title";
    static final String KEY_BODY = "body";
    static final String KEY_GROUP = "groupKey";
    static final String KEY_CATEGORY = "pushCategory";
    static final String KEY_EVENT = "event";
    static final String KEY_RETRACTED_IDS = "retractedIds";
    static final String KEY_APPROVAL_REQUEST_ID = "approvalRequestId";
    static final String KEY_DIALOG_ID = "dialogId";
    static final String KEY_RECIPIENT_USER_ID = "recipientUserId";
    /** An approval's tool-call arguments, the one open-ended attribute; never rendered here. */
    static final String KEY_TOOL_CALLS = "toolCalls";
    static final String EVENT_RETRACTED = "NOTIFICATION_RETRACTED";

    private static final String CHANNEL_PUSH = "of.push";
    private static final String CHANNEL_OUTCOMES = "of.outcomes";
    private static final int NOTIFICATION_ID = 0;
    /** The expedited worker's foreground notification, on API < 31 only. */
    static final int FOREGROUND_ID = 4242;
    /** {@code SendMessageRequest.content} is {@code @Size(max = 10000)}. */
    static final int MAX_REPLY_LENGTH = 10_000;
    /** The most of a body any rendering shows; what the receiver hands the worker is clipped to the same. */
    static final int BODY_LIMIT = 400;

    private PushNotifications() {
    }

    // ─── Channels ────────────────────────────────────────────────────────────

    /** From OpenFrameApplication.onCreate. Idempotent — the system ignores a re-creation. */
    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        // HIGH so approvals show heads-up — and because the backend sends the
        // data message at HIGH priority, which Android 13+ deprioritizes for an
        // app that then posts nothing visible.
        NotificationChannel push = new NotificationChannel(
            CHANNEL_PUSH, context.getString(R.string.push_channel_name), NotificationManager.IMPORTANCE_HIGH);
        push.setDescription(context.getString(R.string.push_channel_description));
        // Bodies name tickets and chats; the lock screen gets the title only.
        push.setLockscreenVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(push);
        // The user just acted; the answer must not alert, only be there.
        NotificationChannel outcomes = new NotificationChannel(
            CHANNEL_OUTCOMES, context.getString(R.string.outcomes_channel_name), NotificationManager.IMPORTANCE_LOW);
        outcomes.setLockscreenVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(outcomes);
    }

    // ─── Rendering ───────────────────────────────────────────────────────────

    /** Post the push as delivered. {@code messageId} is the FCM message id the tap event reports. */
    static void show(Context context, String messageId, Map<String, String> data) {
        String notificationId = data.get(KEY_NOTIFICATION_ID);
        if (notificationId == null || notificationId.isEmpty()) {
            ShellLog.notifications.error("data-only push without a notificationId — nothing to render it under");
            return;
        }
        Map<String, String> extras = extrasOf(messageId, notificationId, data);
        NotificationCompat.Builder builder =
            base(context, CHANNEL_PUSH, data.get(KEY_TITLE), data.get(KEY_BODY), data.get(KEY_GROUP))
            .setContentIntent(contentIntent(context, notificationId, extras))
            .setAutoCancel(true);
        addActions(context, builder, notificationId, data.get(KEY_CATEGORY), extras, null);
        post(context, notificationId, builder.build());
    }

    /** The push, with its buttons swapped for a spinner while the action runs — a second tap has nothing to press. */
    static void markInProgress(Context context, String notificationId, Map<String, String> extras, String actionId) {
        String progressText = context.getString(progressText(actionId));
        NotificationCompat.Builder builder =
            base(context, CHANNEL_OUTCOMES, extras.get(KEY_TITLE), progressText, extras.get(KEY_GROUP))
            .setContentIntent(contentIntent(context, notificationId, extras))
            .setProgress(0, 0, true)
            .setOnlyAlertOnce(true);
        post(context, notificationId, builder.build());
    }

    /**
     * The only place an outcome reaches the user: there is no window to report
     * into. Replaces the push under its own identity, keeps the content intent
     * so a tap opens the same item the push would have, and — when {@code retry}
     * — puts the buttons back, so a failed decision is still there to make. A
     * failed reply carries its text back via the input history: responding to
     * the notification cleared the inline field, so this is the only copy left.
     */
    static void replace(Context context, String notificationId, Map<String, String> extras,
                        String title, String body, boolean retry, String echoReply) {
        NotificationCompat.Builder builder = base(context, CHANNEL_OUTCOMES, title, body, extras.get(KEY_GROUP))
            .setContentIntent(contentIntent(context, notificationId, extras))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true);
        if (retry) {
            addActions(context, builder, notificationId, extras.get(KEY_CATEGORY), extras, echoReply);
        }
        post(context, notificationId, builder.build());
    }

    /**
     * An outcome whose tap opens a store listing instead of the app: the gateway
     * refused this app's bundle (426), so the app could only say the same thing.
     * No buttons — nothing a second press could change. {@code storeUrl} must
     * already be a vetted store URL.
     */
    static void replaceWithStoreLink(Context context, String notificationId, Map<String, String> extras,
                                     String title, String body, String storeUrl) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(storeUrl))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent store = PendingIntent.getActivity(context, requestCode(notificationId, 4), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = base(context, CHANNEL_OUTCOMES, title, body, extras.get(KEY_GROUP))
            .setContentIntent(store)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true);
        post(context, notificationId, builder.build());
    }

    /** Cancel every banner the payload names: the retraction's own id, and the ids resent with every push. */
    static void retract(Context context, Map<String, String> data) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (EVENT_RETRACTED.equals(data.get(KEY_EVENT))) {
            String id = data.get(KEY_NOTIFICATION_ID);
            if (id != null && !id.isEmpty()) {
                manager.cancel(id, NOTIFICATION_ID);
            }
        }
        String retracted = data.get(KEY_RETRACTED_IDS);
        if (retracted == null || retracted.isEmpty()) {
            return;
        }
        try {
            JSONArray ids = new JSONArray(retracted);
            for (int i = 0; i < ids.length(); i++) {
                String id = ids.optString(i, null);
                if (id != null && !id.isEmpty()) {
                    manager.cancel(id, NOTIFICATION_ID);
                }
            }
        } catch (JSONException e) {
            ShellLog.notifications.error("retractedIds is not a JSON array: " + e.getMessage());
        }
    }

    /** The expedited worker's foreground notification (API < 31 runs expedited work as a foreground service). */
    static NotificationCompat.Builder foregroundWork(Context context) {
        return new NotificationCompat.Builder(context, CHANNEL_OUTCOMES)
            .setSmallIcon(R.drawable.ic_stat_openframe)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(context.getString(R.string.action_in_progress))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true);
    }

    static boolean isOwnAction(String actionId) {
        return ACTION_APPROVE.equals(actionId) || ACTION_REJECT.equals(actionId) || ACTION_REPLY.equals(actionId);
    }

    /** Every String extra of an intent, as the map the worker and the outcome builders take. */
    static Map<String, String> stringExtras(Bundle bundle) {
        Map<String, String> extras = new HashMap<>();
        if (bundle == null) {
            return extras;
        }
        for (String key : bundle.keySet()) {
            String value = bundle.getString(key);
            if (value != null) {
                extras.put(key, value);
            }
        }
        return extras;
    }

    // ─── Builders ────────────────────────────────────────────────────────────

    private static NotificationCompat.Builder base(Context context, String channel, String title, String body, String group) {
        String safeTitle = title == null || title.isEmpty() ? context.getString(R.string.app_name) : title;
        String safeBody = body == null ? "" : clip(body, BODY_LIMIT);
        NotificationCompat.Builder publicVersion = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_openframe)
            .setContentTitle(safeTitle);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_openframe)
            .setContentTitle(safeTitle)
            .setContentText(safeBody)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            // Lock-screen visibility is a decision, not a default: the title
            // only, never a ticket or chat body. Same on both channels.
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion.build());
        if (group != null && !group.isEmpty()) {
            builder.setGroup(group);
        }
        return builder;
    }

    private static Map<String, String> extrasOf(String messageId, String notificationId, Map<String, String> data) {
        Map<String, String> extras = new HashMap<>(data);
        extras.put(EXTRA_NOTIFICATION_ID, notificationId);
        extras.put(EXTRA_MESSAGE_ID, messageId == null || messageId.isEmpty() ? notificationId : messageId);
        return extras;
    }

    private static PendingIntent contentIntent(Context context, String notificationId, Map<String, String> extras) {
        return openAppIntent(context, notificationId, 0, extras);
    }

    /**
     * Opens MainActivity carrying the payload. The intent's identity — the data
     * URI — is unique per notification and button: extras do not count towards
     * PendingIntent identity, and FLAG_UPDATE_CURRENT would otherwise hand one
     * notification's ids to another's. The scheme is not the OAuth callback's,
     * so NativeAuthPlugin.handleOnNewIntent ignores it.
     */
    private static PendingIntent openAppIntent(Context context, String notificationId, int slot, Map<String, String> extras) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setData(identity(notificationId, slot))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        putExtras(intent, extras);
        return PendingIntent.getActivity(context, requestCode(notificationId, slot), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static Uri identity(String notificationId, int slot) {
        return Uri.parse("openframe-notification://" + Uri.encode(notificationId) + "/" + slot);
    }

    /**
     * The buttons for the category. While the store is biometric-gated and this
     * process holds no pair, no background handler can read the credential — so
     * every button opens the app instead (the web view's launch read prompts
     * and the tap deep-links to the item), exactly the iOS {@code .foreground}
     * branch. Decided per notification at build time, which iOS's global
     * categories cannot do. {@code setAuthenticationRequired} (API 31+) is the
     * keyguard gate iOS's {@code .authenticationRequired} is — not a biometric one.
     */
    private static void addActions(Context context, NotificationCompat.Builder builder, String notificationId,
                                   String category, Map<String, String> extras, String echoReply) {
        boolean opensApp = TokenLifecycle.get(context).isGatedAndUnprimed();
        if (CATEGORY_APPROVAL.equals(category)) {
            builder.addAction(action(context, ACTION_APPROVE, R.string.action_approve, notificationId, 1, extras, opensApp));
            builder.addAction(action(context, ACTION_REJECT, R.string.action_reject, notificationId, 2, extras, opensApp));
        } else if (CATEGORY_REPLY.equals(category)) {
            PendingIntent target = actionIntent(context, ACTION_REPLY, notificationId, 3, extras, opensApp, !opensApp);
            NotificationCompat.Action.Builder reply = new NotificationCompat.Action.Builder(
                0, context.getString(R.string.action_reply), target)
                .setAuthenticationRequired(true)
                .setAllowGeneratedReplies(false);
            if (!opensApp) {
                reply.addRemoteInput(new RemoteInput.Builder(EXTRA_REPLY_TEXT)
                    .setLabel(context.getString(R.string.reply_hint))
                    .build());
            }
            builder.addAction(reply.build());
            if (echoReply != null && !echoReply.isEmpty()) {
                builder.setRemoteInputHistory(new CharSequence[]{echoReply});
            }
        }
    }

    private static NotificationCompat.Action action(Context context, String actionId, @StringRes int label,
                                                    String notificationId, int slot, Map<String, String> extras,
                                                    boolean opensApp) {
        PendingIntent target = actionIntent(context, actionId, notificationId, slot, extras, opensApp, false);
        return new NotificationCompat.Action.Builder(0, context.getString(label), target)
            .setAuthenticationRequired(true)
            .build();
    }

    private static PendingIntent actionIntent(Context context, String actionId, String notificationId, int slot,
                                              Map<String, String> extras, boolean opensApp, boolean mutable) {
        if (opensApp) {
            return openAppIntent(context, notificationId, slot, extras);
        }
        // Explicit component: a mutable PendingIntent must name its target at
        // targetSdk 31+, and the reply's must be mutable or the typed text is
        // dropped with no error. FLAG_MUTABLE is API 31+; the compat call
        // spells it per level.
        Intent intent = new Intent(context, NotificationActionReceiver.class)
            .setAction(actionId)
            .setData(identity(notificationId, slot));
        putExtras(intent, extras);
        return PendingIntentCompat.getBroadcast(
            context, requestCode(notificationId, slot), intent, PendingIntent.FLAG_UPDATE_CURRENT, mutable);
    }

    private static void putExtras(Intent intent, Map<String, String> extras) {
        // Only String extras: the plugin copies every extra into a map the web
        // view types as Record<string, string>.
        for (Map.Entry<String, String> entry : extras.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }
    }

    private static int requestCode(String notificationId, int slot) {
        return notificationId.hashCode() * 7 + slot;
    }

    private static void post(Context context, String notificationId, Notification notification) {
        boolean permitted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        if (!permitted) {
            ShellLog.notifications.notice("notifications are not permitted — dropping " + notificationId);
            return;
        }
        NotificationManagerCompat.from(context).notify(notificationId, NOTIFICATION_ID, notification);
    }

    /** What the spinner says while an action runs. */
    @StringRes
    private static int progressText(String actionId) {
        switch (actionId) {
            case ACTION_APPROVE:
                return R.string.action_approving;
            case ACTION_REJECT:
                return R.string.action_rejecting;
            default:
                return R.string.action_sending_reply;
        }
    }

    /** The first {@code limit} chars, never splitting a surrogate pair. */
    static String clip(String text, int limit) {
        if (limit <= 0) {
            return "";
        }
        if (text.length() <= limit) {
            return text;
        }
        int end = Character.isHighSurrogate(text.charAt(limit - 1)) ? limit - 1 : limit;
        return text.substring(0, end);
    }
}
