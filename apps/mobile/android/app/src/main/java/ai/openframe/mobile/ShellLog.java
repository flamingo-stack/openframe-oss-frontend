package ai.openframe.mobile;

import android.util.Log;

/**
 * The shell's log streams, mirroring ios/App/App/ShellLog.swift:
 * {@code adb logcat -s OpenFrameAuth OpenFrameNotifications OpenFrameUpdate}.
 */
final class ShellLog {

    static final ShellLog auth = new ShellLog("OpenFrameAuth");
    static final ShellLog notifications = new ShellLog("OpenFrameNotifications");
    static final ShellLog update = new ShellLog("OpenFrameUpdate");

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
