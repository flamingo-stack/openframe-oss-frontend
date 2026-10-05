package ai.openframe.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.core.app.RemoteInput;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

import java.util.HashMap;
import java.util.Map;

/**
 * Where the three tray buttons land. A receiver has roughly ten seconds, and a
 * token refresh with retries plus the request can outrun it, so this only
 * validates the press, hands the work to {@link NotificationActionWorker} as
 * expedited work — the Android answer to iOS's background-task assertion around
 * the same two steps — and then swaps the buttons for a spinner.
 */
public class NotificationActionReceiver extends BroadcastReceiver {

    /** Worker inputs, namespaced apart from the {@code of.*} intent actions they travel with. */
    static final String INPUT_ACTION = "of.input.action";
    static final String INPUT_REPLY = "of.input.reply";
    /**
     * WorkManager's Data is capped at 10240 serialized bytes and its builder
     * throws past it. The payload's two open-ended values are dropped or clipped
     * (the outcome shows at most a body excerpt, and retracted ids are moot once
     * delivered), and the reply takes whatever is left — a tray field is a short
     * message; the 10,000-character server limit is out of reach here.
     */
    private static final int DATA_BUDGET_BYTES = 9_000;

    @Override
    public void onReceive(Context context, Intent intent) {
        String actionId = intent.getAction();
        if (!PushNotifications.isOwnAction(actionId)) {
            return;
        }
        Bundle bundle = intent.getExtras();
        Map<String, String> extras = PushNotifications.stringExtras(bundle);
        String notificationId = extras.get(PushNotifications.EXTRA_NOTIFICATION_ID);
        if (notificationId == null || notificationId.isEmpty()) {
            ShellLog.notifications.error(actionId + " pressed on a notification with no id");
            return;
        }
        Map<String, String> forwarded = trimmed(extras);
        String reply = null;
        if (PushNotifications.ACTION_REPLY.equals(actionId)) {
            Bundle results = RemoteInput.getResultsFromIntent(intent);
            CharSequence typed = results == null ? null : results.getCharSequence(PushNotifications.EXTRA_REPLY_TEXT);
            reply = typed == null ? "" : typed.toString().trim();
            if (reply.isEmpty()) {
                // Nothing to send — but a RemoteInput send leaves the system's own
                // spinner on the row until the notification is posted again.
                restore(context, notificationId, forwarded, null);
                return;
            }
            reply = PushNotifications.clip(reply, PushNotifications.MAX_REPLY_LENGTH);
        }
        ShellLog.notifications.notice(actionId + " pressed on " + notificationId);

        Data.Builder input = new Data.Builder().putString(INPUT_ACTION, actionId);
        for (Map.Entry<String, String> entry : forwarded.entrySet()) {
            input.putString(entry.getKey(), entry.getValue());
        }
        if (reply != null) {
            String fitted = fitReply(reply, forwarded);
            if (fitted.isEmpty()) {
                ShellLog.notifications.error("no room left for the reply text on " + notificationId
                    + " — leaving the buttons in place");
                restore(context, notificationId, forwarded, reply);
                return;
            }
            input.putString(INPUT_REPLY, fitted);
        }
        Data data;
        try {
            data = input.build();
        } catch (IllegalStateException e) {
            // Past the cap even after trimming: leave the buttons in place.
            ShellLog.notifications.error(actionId + " on " + notificationId + " carries too much to hand off: " + e.getMessage());
            restore(context, notificationId, forwarded, reply);
            return;
        }
        // The spinner goes up before the enqueue, whose insert is asynchronous:
        // a worker that settles without I/O could otherwise post its outcome
        // first and have the spinner land on top of it.
        PushNotifications.markInProgress(context, notificationId, forwarded, actionId);
        try {
            // Unique per notification and button: a second press while the first
            // is queued cannot stack a second run.
            WorkManager.getInstance(context)
                .beginUniqueWork(notificationId + "|" + actionId, ExistingWorkPolicy.KEEP,
                    new OneTimeWorkRequest.Builder(NotificationActionWorker.class)
                        .setInputData(data)
                        .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                        .build())
                .enqueue();
        } catch (RuntimeException e) {
            ShellLog.notifications.error(actionId + " on " + notificationId + " could not be queued: " + e);
            restore(context, notificationId, forwarded, reply);
        }
    }

    /** The push as delivered, buttons back; a typed reply is echoed so it is not lost. */
    private static void restore(Context context, String notificationId, Map<String, String> forwarded, String reply) {
        PushNotifications.replace(context, notificationId, forwarded,
            forwarded.get(PushNotifications.KEY_TITLE), forwarded.get(PushNotifications.KEY_BODY), true, reply);
    }

    private static Map<String, String> trimmed(Map<String, String> extras) {
        Map<String, String> forwarded = new HashMap<>(extras);
        forwarded.remove(PushNotifications.KEY_RETRACTED_IDS);
        forwarded.remove(PushNotifications.KEY_TOOL_CALLS);
        String body = forwarded.get(PushNotifications.KEY_BODY);
        if (body != null) {
            forwarded.put(PushNotifications.KEY_BODY, PushNotifications.clip(body, PushNotifications.BODY_LIMIT));
        }
        return forwarded;
    }

    /** The reply, cut to the bytes the Data budget has left after the forwarded extras. */
    private static String fitReply(String reply, Map<String, String> forwarded) {
        int used = 0;
        for (Map.Entry<String, String> entry : forwarded.entrySet()) {
            used += modifiedUtf8Length(entry.getKey()) + modifiedUtf8Length(entry.getValue()) + 8;
        }
        int allowed = DATA_BUDGET_BYTES - used - modifiedUtf8Length(INPUT_REPLY) - 8;
        if (allowed <= 0) {
            return "";
        }
        if (modifiedUtf8Length(reply) <= allowed) {
            return reply;
        }
        // Worst case three bytes per char; clip on a char count that cannot exceed the budget.
        return PushNotifications.clip(reply, allowed / 3);
    }

    /** What DataOutputStream.writeUTF spends: modified UTF-8, per UTF-16 unit (a surrogate pair is 6 bytes, NUL is 2). */
    private static int modifiedUtf8Length(String text) {
        int bytes = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c != 0 && c < 0x80) {
                bytes += 1;
            } else if (c < 0x800) {
                bytes += 2;
            } else {
                bytes += 3;
            }
        }
        return bytes;
    }
}
