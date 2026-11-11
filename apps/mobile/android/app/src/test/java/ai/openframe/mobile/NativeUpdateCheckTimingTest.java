package ai.openframe.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import ai.openframe.mobile.CheckSchedule.Asked;

/**
 * When the updater asks the gateway. The shell's own check runs on the first
 * activation of a process and then at most hourly; a check the page asks for
 * always runs, unless one has only just finished. Data Saver holds back the
 * download of the shell's own check, never the asking and never the page's.
 * And it asks one place only: the shared host the binary was compiled with,
 * a bare https origin.
 */
public class NativeUpdateCheckTimingTest {

    private static final long MINUTE = 60_000;
    private static final long HOUR = 60 * MINUTE;
    private static final long NOW = 10 * HOUR;
    private static final boolean DATA_SAVER = true;

    /** A schedule whose last check started at {@code startedAt} and ended at {@code finishedAt}, having had nothing to download. */
    private static CheckSchedule checkedAt(long startedAt, long finishedAt) {
        CheckSchedule schedule = new CheckSchedule();
        assertEquals(Asked.STARTED, schedule.ask(false, startedAt));
        assertFalse(schedule.finish(finishedAt));
        return schedule;
    }

    @Test
    public void theFirstActivationOfAProcessChecks() {
        assertEquals(Asked.STARTED, new CheckSchedule().ask(false, NOW));
        assertEquals("even right after boot, when the clock reads zero", Asked.STARTED, new CheckSchedule().ask(false, 0));
    }

    @Test
    public void aLaterActivationChecksOnceTheLastCheckStartedAnHourAgo() {
        assertEquals(Asked.ANSWERED, checkedAt(NOW - HOUR + 1, NOW - HOUR + 5_000).ask(false, NOW));
        assertEquals(Asked.STARTED, checkedAt(NOW - HOUR, NOW - HOUR + 5_000).ask(false, NOW));
        assertEquals("counted from the start of a long check, not its end", Asked.ANSWERED, checkedAt(NOW - HOUR + 1, NOW - 1).ask(false, NOW));
        assertEquals(Asked.STARTED, checkedAt(NOW - HOUR, NOW - 1).ask(false, NOW));
    }

    @Test
    public void thePagesCheckRunsUnlessOneFinishedWithinTheLastMinute() {
        assertEquals(Asked.STARTED, new CheckSchedule().ask(true, NOW));
        assertEquals(Asked.ANSWERED, checkedAt(NOW - 5 * MINUTE, NOW - MINUTE + 1).ask(true, NOW));
        assertEquals(Asked.STARTED, checkedAt(NOW - 5 * MINUTE, NOW - MINUTE).ask(true, NOW));
        assertEquals(
            "an activation check an hour is not due for does not hold the page's back",
            Asked.STARTED,
            checkedAt(NOW - 2 * MINUTE, NOW - MINUTE).ask(true, NOW)
        );
    }

    @Test
    public void aCheckAskedForWhileOneRunsJoinsIt() {
        CheckSchedule schedule = new CheckSchedule();
        assertEquals(Asked.STARTED, schedule.ask(false, NOW));

        assertEquals(Asked.JOINED, schedule.ask(true, NOW + 1));
        assertEquals(Asked.JOINED, schedule.ask(false, NOW + 2));

        assertFalse(schedule.finish(NOW + 3));
        assertEquals("the one that ran answers the page for the next minute", Asked.ANSWERED, schedule.ask(true, NOW + 4));
    }

    // ─── Data Saver ──────────────────────────────────────────────────────────

    @Test
    public void withoutDataSaverEveryCheckDownloads() {
        CheckSchedule shell = new CheckSchedule();
        shell.ask(false, NOW);
        CheckSchedule page = new CheckSchedule();
        page.ask(true, NOW);

        assertTrue(shell.mayDownload(!DATA_SAVER));
        assertTrue(page.mayDownload(!DATA_SAVER));
    }

    @Test
    public void underDataSaverTheShellsOwnCheckLeavesTheDownloadAndThePagesDownloads() {
        CheckSchedule shell = new CheckSchedule();
        shell.ask(false, NOW);
        CheckSchedule page = new CheckSchedule();
        page.ask(true, NOW);

        assertFalse(shell.mayDownload(DATA_SAVER));
        assertTrue("the user is looking at the Update Required screen", page.mayDownload(DATA_SAVER));
    }

    @Test
    public void aCheckThePageJoinedBeforeItsDownloadDownloadsUnderDataSaver() {
        CheckSchedule schedule = new CheckSchedule();
        schedule.ask(false, NOW);
        assertEquals(Asked.JOINED, schedule.ask(true, NOW + 1));

        assertTrue(schedule.mayDownload(DATA_SAVER));
        assertFalse("and it is the page's answer", schedule.finish(NOW + 2));
    }

    @Test
    public void aCheckThatLeftItsDownloadDoesNotAnswerThePageHoweverRecentItIs() {
        CheckSchedule schedule = new CheckSchedule();
        schedule.ask(false, NOW);
        assertFalse(schedule.mayDownload(DATA_SAVER));
        assertFalse(schedule.finish(NOW + 1_000));

        assertEquals("the shell's own check is not due again for it", Asked.ANSWERED, schedule.ask(false, NOW + 2_000));
        assertEquals(Asked.STARTED, schedule.ask(true, NOW + 2_000));
        assertTrue(schedule.mayDownload(DATA_SAVER));
        assertFalse(schedule.finish(NOW + 3_000));
        assertEquals("downloaded now, so the last check answers again", Asked.ANSWERED, schedule.ask(true, NOW + 4_000));
    }

    @Test
    public void aPageThatJoinsAfterTheDownloadWasLeftGetsACheckThatDownloadsInItsPlace() {
        CheckSchedule schedule = new CheckSchedule();
        schedule.ask(false, NOW);
        assertFalse(schedule.mayDownload(DATA_SAVER));
        assertEquals(Asked.JOINED, schedule.ask(true, NOW + 1));

        assertTrue("another check starts at once, the page still waiting", schedule.finish(NOW + 2));

        assertEquals("it is running: a further ask joins it", Asked.JOINED, schedule.ask(true, NOW + 3));
        assertTrue(schedule.mayDownload(DATA_SAVER));
        assertFalse("and it ends the waiting", schedule.finish(NOW + 4));
        assertEquals(Asked.ANSWERED, schedule.ask(true, NOW + 5));
    }

    @Test
    public void aLaterCheckOfTheShellIsHeldBackByDataSaverAgain() {
        CheckSchedule schedule = new CheckSchedule();
        schedule.ask(true, NOW);
        assertTrue(schedule.mayDownload(DATA_SAVER));
        schedule.finish(NOW + 1);

        assertEquals(Asked.STARTED, schedule.ask(false, NOW + HOUR));

        assertFalse("the page's wish ended with its check", schedule.mayDownload(DATA_SAVER));
    }

    // ─── The shared host ─────────────────────────────────────────────────────

    @Test
    public void theManifestIsAskedOfAnHttpsSharedHostOnly() {
        assertNull(UpdateChecker.manifestUrl(""));
        assertNull(UpdateChecker.manifestUrl("http://openframe.ai"));
        assertNull(UpdateChecker.manifestUrl("HTTPS://openframe.ai"));
        assertNull(UpdateChecker.manifestUrl("openframe.ai"));
        assertNull(UpdateChecker.manifestUrl("https://"));
        assertNotNull(UpdateChecker.manifestUrl("https://openframe.ai"));
    }

    @Test
    public void theSharedHostIsABareOriginAndNothingElse() {
        String[] refused = {
            "https://user@openframe.ai",
            "https://user:secret@openframe.ai",
            "https://:secret@openframe.ai",
            "https://openframe.ai/auth",
            "https://openframe.ai/auth/",
            "https://openframe.ai//x",
            "https://openframe.ai?tenant=a",
            "https://openframe.ai/?tenant=a",
            "https://openframe.ai?",
            "https://openframe.ai#top",
            "https://openframe.ai/#top",
            "https://openframe.ai#",
            "https:///openframe.ai",
            "https:///openframe.ai/auth",
            "https://\\openframe.ai",
            "https://openframe.ai\\auth",
            "https:// openframe.ai",
        };
        for (String host : refused) {
            assertNull(host, UpdateChecker.manifestUrl(host));
        }

        assertEquals(
            "a port is part of an origin",
            "https://openframe.ai:8443/v0/api/assets/download?agent=mobile&file=mobile.json",
            String.valueOf(UpdateChecker.manifestUrl("https://openframe.ai:8443/"))
        );
    }

    @Test
    public void theManifestUrlIsTheGatewaysDownloadEndpointWhateverSlashesTheHostEndsIn() {
        String expected = "https://openframe.ai/v0/api/assets/download?agent=mobile&file=mobile.json";

        for (String host : new String[] {"https://openframe.ai", "https://openframe.ai/", "https://openframe.ai///"}) {
            assertTrue(host, expected.equals(String.valueOf(UpdateChecker.manifestUrl(host))));
        }
    }
}
