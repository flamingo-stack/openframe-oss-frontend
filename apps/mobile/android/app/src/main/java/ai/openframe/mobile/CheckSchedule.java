package ai.openframe.mobile;

/**
 * When the updater asks the gateway, and whether a check that finds a release
 * may download it: the bookkeeping of {@link NativeUpdate#check}, with no
 * clock and no thread of its own. Times are elapsedRealtime. Not thread-safe:
 * NativeUpdate calls it under its check lock.
 *
 * The shell's own check runs on the first activation of a process, then when
 * the last one started at least an hour ago. The page's runs unless one has
 * only just finished. Under Data Saver on a metered network the shell's check
 * still asks (a rollback or a kill is all in the manifest) and leaves a
 * download for later; the page's, asked for from the "Update required"
 * screen, downloads all the same.
 */
final class CheckSchedule {

    /** What became of a check that was asked for. */
    enum Asked {
        /** None runs for it: the last one answers. */
        ANSWERED,
        /** One is running, and its end answers this one too. */
        JOINED,
        /** It starts now. */
        STARTED
    }

    /** An activation checks again once the last check started this long ago. */
    static final long CHECK_EVERY_MS = 60 * 60 * 1000;
    /** A check the page asks for within this long of the last one's end is answered from the state as it is. */
    static final long RECENT_CHECK_MS = 60 * 1000;
    private static final long NEVER = -1;

    private boolean checking;
    /** The page asked for the running check or joined it. */
    private boolean pageAsked;
    /** The running check, or else the last one, left a bundle undownloaded because of Data Saver. */
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

    /** Whether the running check, which has a bundle to download, downloads it now. */
    boolean mayDownload(boolean dataSaverRestricts) {
        downloadDeferred = dataSaverRestricts && !pageAsked;
        return !downloadDeferred;
    }

    /**
     * The running check has ended.
     *
     * @return whether another one starts at once, in its place: the page joined this one after it had left
     *         its download for later, and is owed a check that downloads. Its waiters wait on.
     */
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
