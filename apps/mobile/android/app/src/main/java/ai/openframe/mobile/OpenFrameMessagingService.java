package ai.openframe.mobile;

import android.annotation.SuppressLint;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;

/**
 * Owns FCM delivery. Extends the Firebase plugin's service so the JS side keeps
 * {@code onNewToken} and {@code notificationReceived} (and the plugin's cold-start replay
 * slot) exactly as before; the plugin's own registration is removed in the
 * manifest, because firebase-messaging binds the FIRST service matching
 * MESSAGING_EVENT and caches it for the process lifetime.
 *
 * What reaches here: every data-only push (the backend's capable-Android arm),
 * every retraction, and a baseline notification-block push only while the app
 * is foregrounded (the SDK renders those itself otherwise, and never calls
 * this). A banner is posted only for the first kind, and only while no
 * Activity of ours is started — the web view's own in-app handling has the
 * foreground, as iOS's {@code presentationOptions: []} arranges there.
 *
 * {@code onNewToken} is the parent's: it forwards to the plugin, which is where
 * JS observes rotations — hence the suppressed lint.
 */
@SuppressLint("MissingFirebaseInstanceTokenRefresh")
public class OpenFrameMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Map<String, String> data = message.getData();
        // Every push carries the freshest retracted ids; a retraction carries its own.
        PushNotifications.retract(getApplicationContext(), data);
        if (PushNotifications.EVENT_RETRACTED.equals(data.get(PushNotifications.KEY_EVENT))) {
            return;
        }
        if (!data.containsKey(PushNotifications.KEY_TITLE)) {
            // The baseline arm, foregrounded: the SDK would have rendered it in
            // the background, and the web view has it now.
            return;
        }
        if (TokenLifecycle.get(this).isForeground()) {
            ShellLog.notifications.notice("push " + data.get(PushNotifications.KEY_NOTIFICATION_ID)
                + " arrived while foregrounded — the web view has it, no banner");
            return;
        }
        PushNotifications.show(getApplicationContext(), message.getMessageId(), data);
    }
}
