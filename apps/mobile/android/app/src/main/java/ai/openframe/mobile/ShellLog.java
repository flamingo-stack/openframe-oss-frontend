package ai.openframe.mobile;

import android.util.Log;

/**
 * The shell's two log streams, mirroring ios/App/App/ShellLog.swift:
 * {@code adb logcat -s OpenFrameAuth OpenFrameNotifications}.
 */
final class ShellLog {

    static final ShellLog auth = new ShellLog("OpenFrameAuth");
    static final ShellLog notifications = new ShellLog("OpenFrameNotifications");

    private final String tag;

    private ShellLog(String tag) {
        this.tag = tag;
    }

    void notice(String message) {
        Log.i(tag, message);
    }

    void error(String message) {
        Log.e(tag, message);
    }
}
