package ai.openframe.mobile;

// Times are elapsedRealtime. Not thread-safe: NativeUpdate calls it under its check lock.
//
// Under Data Saver on a metered network the shell's check still asks (a rollback or a kill is all in
// the manifest) and leaves a download for later; the page's, asked for from the "Update required"
// screen, downloads all the same.
//
// The iOS twin is OtaCore's OtaCheckSchedule, with the cases of NativeUpdateCheckTimingTest again in
// its CheckScheduleTests: a rule changed here is changed there.
final class CheckSchedule {

    enum Asked {
        ANSWERED,
        JOINED,
        STARTED
    }

    static final long CHECK_EVERY_MS = 60 * 60 * 1000;
    // The web's retry (LOOK_AGAIN_MS, 65 s, in apps/web/src/app/components/update-required-screen.tsx) is timed just past it.
    static final long RECENT_CHECK_MS = 60 * 1000;
    private static final long NEVER = -1;

    private boolean checking;
    private boolean pageAsked;
    private boolean downloadDeferred;
    private long lastStartedAt = NEVER;
    private long lastFinishedAt = NEVER;

    Asked ask(boolean fromPage, long now) {
        if (!checking && !isDue(fromPage, now)) {
            return Asked.ANSWERED;
        }
        pageAsked = pageAsked || fromPage;
        if (checking) {
            return Asked.JOINED;
        }
        checking = true;
        downloadDeferred = false;
        lastStartedAt = now;
        return Asked.STARTED;
    }

    private boolean isDue(boolean fromPage, long now) {
        if (fromPage) {
            // A check that left its download for later has not answered the page, however recent it is.
            return lastFinishedAt == NEVER || downloadDeferred || now - lastFinishedAt >= RECENT_CHECK_MS;
        }
        return lastStartedAt == NEVER || now - lastStartedAt >= CHECK_EVERY_MS;
    }

    boolean mayDownload(boolean dataSaverRestricts) {
        downloadDeferred = dataSaverRestricts && !pageAsked;
        return !downloadDeferred;
    }

    // True when another check starts at once, in its place: the page joined this one after it had left its
    // download for later, and is owed a check that downloads. Its waiters wait on.
    boolean finish(long now) {
        if (pageAsked && downloadDeferred) {
            downloadDeferred = false;
            lastStartedAt = now;
            return true;
        }
        checking = false;
        pageAsked = false;
        lastFinishedAt = now;
        return false;
    }
}
