package ai.openframe.mobile;

import android.app.Application;
import io.sentry.android.core.SentryAndroid;

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
        startErrorReporting();
        TokenLifecycle.get(this).installObservers();
        PushNotifications.createChannels(this);
    }

    private void startErrorReporting() {
        String dsn = BuildConfig.OPENFRAME_SENTRY_DSN;
        if (dsn.isEmpty()) return;
        SentryAndroid.init(this, options -> {
            options.setDsn(dsn);
            // The same names the web bundle reports under (NEXT_PUBLIC_SENTRY_ENVIRONMENT).
            options.setEnvironment("prod".equals(BuildConfig.FLAVOR) ? "production" : BuildConfig.FLAVOR);
        });
    }
}
