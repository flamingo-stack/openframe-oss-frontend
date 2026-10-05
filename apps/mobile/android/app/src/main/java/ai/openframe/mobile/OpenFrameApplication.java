package ai.openframe.mobile;

import android.app.Application;

/**
 * The process-level init point — the Android twin of AppDelegate. The Capacitor
 * bridge exists only while MainActivity does, but the token lifecycle and the
 * notification path run in processes started by a push or a tray action with no
 * Activity at all, so what they need is wired here.
 */
public class OpenFrameApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        TokenLifecycle.get(this).installObservers();
        PushNotifications.createChannels(this);
    }
}
