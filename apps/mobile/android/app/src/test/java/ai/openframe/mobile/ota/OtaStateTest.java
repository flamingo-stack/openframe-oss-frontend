package ai.openframe.mobile.ota;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The state rules of the over-the-air updater: which bundle a process boots,
 * what a trial costs and how it is confirmed, what each decision of a check
 * leaves behind, and which directories may go.
 */
public class OtaStateTest {

    private static final String BUILTIN = "1.2.0";
    private static final List<String> NONE = Collections.emptyList();
    private static final OtaState.Usable ALL_ON_DISK = version -> true;

    private static OtaState state(String active, String pending, int attempts, String... bad) {
        return OtaState.of(active, pending, attempts, Arrays.asList(bad));
    }

    // ─── resolveBoot ─────────────────────────────────────────────────────────

    @Test
    public void withNoBundleTheBuiltinOneBoots() {
        OtaState.Boot boot = OtaState.resolveBoot(OtaState.EMPTY, BUILTIN, ALL_ON_DISK);

        assertNull(boot.version);
        assertFalse(boot.trial);
        assertEquals(OtaState.EMPTY, boot.state);
    }

    @Test
    public void theActiveBundleBootsAndIsNoTrial() {
        OtaState before = state("1.2.3", null, 0);

        OtaState.Boot boot = OtaState.resolveBoot(before, BUILTIN, ALL_ON_DISK);

        assertEquals("1.2.3", boot.version);
        assertFalse(boot.trial);
        assertEquals(before, boot.state);
    }

    @Test
    public void thePendingBundleBootsBeforeTheActiveOneAsACountedTrial() {
        OtaState.Boot boot = OtaState.resolveBoot(state("1.2.3", "1.2.4", 0), BUILTIN, ALL_ON_DISK);

        assertEquals("1.2.4", boot.version);
        assertTrue(boot.trial);
        assertEquals(state("1.2.3", "1.2.4", 1), boot.state);
    }

    @Test
    public void threeLaunchesWithoutReadyRevertTheBundle() {
        OtaState.Boot first = OtaState.resolveBoot(state("1.2.3", "1.2.4", 0), BUILTIN, ALL_ON_DISK);
        OtaState.Boot second = OtaState.resolveBoot(first.state, BUILTIN, ALL_ON_DISK);
        OtaState.Boot third = OtaState.resolveBoot(second.state, BUILTIN, ALL_ON_DISK);

        assertEquals("1.2.4", first.version);
        assertTrue(first.trial);
        assertEquals(state("1.2.3", "1.2.4", 1), first.state);
        assertEquals("1.2.4", second.version);
        assertTrue(second.trial);
        assertEquals(state("1.2.3", "1.2.4", 2), second.state);
        assertEquals("the active bundle boots once two trial launches are used up", "1.2.3", third.version);
        assertFalse(third.trial);
        assertEquals(state("1.2.3", null, 0, "1.2.4"), third.state);
        assertEquals("the decision names the bundle it marked bad", "1.2.4", third.reverted);
    }

    @Test
    public void onlyAUsedUpTrialIsReportedAsReverted() {
        assertNull("a trial that boots", OtaState.resolveBoot(state("1.2.3", "1.2.4", 1), BUILTIN, ALL_ON_DISK).reverted);
        assertNull("no pending bundle", OtaState.resolveBoot(state("1.2.3", null, 0, "1.2.4"), BUILTIN, ALL_ON_DISK).reverted);
        assertNull(
            "a used-up trial that is not usable any more is dropped, not marked bad",
            OtaState.resolveBoot(state("1.2.3", "1.2.4", OtaState.MAX_TRIAL_ATTEMPTS), BUILTIN, version -> version.equals("1.2.3")).reverted
        );
        assertNull(
            "one a store update overtook is forgotten",
            OtaState.resolveBoot(state(null, "1.2.4", OtaState.MAX_TRIAL_ATTEMPTS), "1.2.4", ALL_ON_DISK).reverted
        );
    }

    @Test
    public void aUsedUpPendingBundleWithNoActiveOneFallsBackToTheBuiltin() {
        OtaState.Boot boot = OtaState.resolveBoot(state(null, "1.2.4", OtaState.MAX_TRIAL_ATTEMPTS), BUILTIN, ALL_ON_DISK);

        assertNull(boot.version);
        assertEquals(state(null, null, 0, "1.2.4"), boot.state);
    }

    @Test
    public void aStoreUpdateOverOtaBundlesForgetsThoseAtOrBelowItsOwnVersion() {
        OtaState before = state("1.2.3", "1.3.0", 1, "1.2.2", "1.3.0", "1.4.0");

        OtaState.Boot boot = OtaState.resolveBoot(before, "1.3.0", ALL_ON_DISK);

        assertNull("neither bundle is above the new built-in one", boot.version);
        assertFalse(boot.trial);
        assertEquals(state(null, null, 0, "1.4.0"), boot.state);
    }

    @Test
    public void bundlesAtOrBelowTheBuiltinVersionAreNotLookedForOnDisk() {
        List<String> asked = new ArrayList<>();

        OtaState.resolveBoot(state("1.1.0", "1.2.0", 0), BUILTIN, version -> asked.add(version));

        assertEquals(NONE, asked);
    }

    @Test
    public void versionsCompareByNumberAtBoot() {
        OtaState.Boot boot = OtaState.resolveBoot(state("1.10.0", null, 0), "1.9.0", ALL_ON_DISK);

        assertEquals("1.10.0", boot.version);
    }

    @Test
    public void aPendingBundleThatIsNotUsableIsDroppedAndNotMarkedBad() {
        OtaState.Boot boot = OtaState.resolveBoot(state("1.2.3", "1.2.4", 1), BUILTIN, version -> version.equals("1.2.3"));

        assertEquals("1.2.3", boot.version);
        assertFalse(boot.trial);
        assertEquals(state("1.2.3", null, 0), boot.state);
    }

    @Test
    public void anActiveBundleThatIsNotUsableIsDroppedAndNotMarkedBad() {
        OtaState.Boot boot = OtaState.resolveBoot(state("1.2.3", null, 0), BUILTIN, version -> false);

        assertNull(boot.version);
        assertEquals(OtaState.EMPTY, boot.state);
    }

    // ─── applyReady ──────────────────────────────────────────────────────────

    @Test
    public void readyFromATrialMakesItTheActiveBundle() {
        assertEquals(state("1.2.4", null, 0, "1.2.1"), OtaState.applyReady(state("1.2.3", "1.2.4", 1, "1.2.1"), "1.2.4", true));
    }

    @Test
    public void readyFromTheActiveOrTheBuiltinBundleChangesNothing() {
        OtaState active = state("1.2.3", null, 0);

        assertSame(active, OtaState.applyReady(active, "1.2.3", false));
        assertSame(OtaState.EMPTY, OtaState.applyReady(OtaState.EMPTY, null, false));
    }

    @Test
    public void readyDoesNotConfirmABundleDownloadedDuringTheSession() {
        // The page that reports ready booted from 1.2.3; 1.2.4 arrived since and has never run.
        OtaState state = state("1.2.3", "1.2.4", 0);

        assertSame(state, OtaState.applyReady(state, "1.2.3", false));
        assertSame(state, OtaState.applyReady(state, null, false));
    }

    @Test
    public void readyFromATrialDoesNotConfirmAnotherPendingBundle() {
        // On trial with 1.2.4 when the check replaced it with 1.2.5.
        OtaState state = state("1.2.3", "1.2.5", 0);

        assertSame(state, OtaState.applyReady(state, "1.2.4", true));
    }

    // ─── After a decision ────────────────────────────────────────────────────

    @Test
    public void dropForgetsBothBundlesAndKeepsWhatIsBad() {
        assertEquals(state(null, null, 0, "1.2.1"), OtaState.applyDrop(state("1.2.3", "1.2.4", 1, "1.2.1")));
    }

    @Test
    public void nothingAboutTheActiveBundleForgetsAPendingOneThatHasNotBooted() {
        // The environment went back to 1.2.3 after 1.2.4 was downloaded.
        assertEquals(state("1.2.3", null, 0), OtaState.applyNothing(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.3", false));
        assertEquals(state("1.2.3", null, 0), OtaState.applyNothing(state("1.2.3", "1.2.4", 1), "1.2.3", "1.2.4", false));
    }

    @Test
    public void nothingAboutTheActiveBundleKeepsThePendingOneThisProcessRunsOnTrial() {
        OtaState state = state("1.2.3", "1.2.4", 1);

        assertSame(state, OtaState.applyNothing(state, "1.2.3", "1.2.4", true));
    }

    @Test
    public void nothingAboutAnyOtherReleaseChangesNothing() {
        OtaState pending = state("1.2.3", "1.2.4", 0, "1.2.5");

        assertSame("the pending bundle's own release", pending, OtaState.applyNothing(pending, "1.2.4", "1.2.3", false));
        assertSame("a release marked bad", pending, OtaState.applyNothing(pending, "1.2.5", "1.2.3", false));
        assertSame("a bridge level above the shell's", pending, OtaState.applyNothing(pending, "1.2.6", "1.2.3", false));
    }

    @Test
    public void aFinishedDownloadIsThePendingBundleWithNoAttempts() {
        assertEquals(state("1.2.3", "1.2.5", 0), OtaState.applyDownloaded(state("1.2.3", "1.2.4", 1), "1.2.5"));
        assertEquals(state(null, "1.2.5", 0), OtaState.applyDownloaded(OtaState.EMPTY, "1.2.5"));
    }

    @Test
    public void badKeepsTheTwentyMostRecentAndEachOnce() {
        OtaState state = OtaState.EMPTY;
        for (int patch = 1; patch <= 25; patch++) {
            state = OtaState.markBad(state, "2.0." + patch);
        }
        assertEquals(20, state.bad.size());
        assertEquals("the oldest went first", "2.0.6", state.bad.get(0));
        assertEquals("2.0.25", state.bad.get(19));

        OtaState again = OtaState.markBad(state, "2.0.10");

        assertEquals(20, again.bad.size());
        assertEquals("marked again, it is the most recent", "2.0.10", again.bad.get(19));
    }

    // ─── Directories ─────────────────────────────────────────────────────────

    @Test
    public void onlyTheActiveThePendingAndTheBootedDirectoriesAreKept() {
        List<String> onDisk = Arrays.asList("1.2.1", "1.2.2", "1.2.3", "1.2.4", "leftover");

        List<String> stale = OtaState.staleDirectories(onDisk, state("1.2.3", "1.2.4", 0), "1.2.2");

        assertEquals(Arrays.asList("1.2.1", "leftover"), stale);
    }

    @Test
    public void theDirectoryTheWebViewRunsFromSurvivesADrop() {
        List<String> onDisk = Arrays.asList("1.2.3", "1.2.4");

        List<String> stale = OtaState.staleDirectories(onDisk, OtaState.applyDrop(state("1.2.3", "1.2.4", 0)), "1.2.3");

        assertEquals(Collections.singletonList("1.2.4"), stale);
    }

    @Test
    public void bootedFromTheBuiltinBundleEveryUnnamedDirectoryGoes() {
        assertEquals(Arrays.asList("1.2.3", "1.2.4"), OtaState.staleDirectories(Arrays.asList("1.2.3", "1.2.4"), OtaState.EMPTY, null));
    }

    // ─── state.json ──────────────────────────────────────────────────────────

    @Test
    public void aStateReadsBackAsItWasWritten() {
        Set<OtaState> states = new HashSet<>(Arrays.asList(
            OtaState.EMPTY,
            state("1.2.3", null, 0),
            state(null, "1.2.4", 2),
            state("1.2.3", "1.2.4", 1, "1.2.1", "1.10.0")
        ));
        for (OtaState state : states) {
            assertEquals(state, OtaState.parse(state.toJson()));
        }
    }

    @Test
    public void theStateFileHasTheDocumentedShape() {
        assertEquals(
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":{\"version\":\"1.2.4\",\"attempts\":1},\"bad\":[\"1.2.1\",\"1.2.2\"]}\n",
            new String(state("1.2.3", "1.2.4", 1, "1.2.1", "1.2.2").toJson(), StandardCharsets.US_ASCII)
        );
        assertEquals(
            "{\"schema\":1,\"active\":null,\"pending\":null,\"bad\":[]}\n",
            new String(OtaState.EMPTY.toJson(), StandardCharsets.US_ASCII)
        );
    }

    @Test
    public void aStateFileThatIsNotAWholeStateOfThisSchemaIsTheEmptyState() {
        String[] files = {
            "",
            "not json",
            "[]",
            "{\"schema\":2,\"active\":\"1.2.3\",\"pending\":null,\"bad\":[]}",
            "{\"schema\":\"1\",\"active\":\"1.2.3\",\"pending\":null,\"bad\":[]}",
            "{\"active\":\"1.2.3\",\"pending\":null,\"bad\":[]}",
            "{\"schema\":1,\"pending\":null,\"bad\":[]}",
            "{\"schema\":1,\"active\":\"../../etc\",\"pending\":null,\"bad\":[]}",
            "{\"schema\":1,\"active\":\"1.2\",\"pending\":null,\"bad\":[]}",
            "{\"schema\":1,\"active\":7,\"pending\":null,\"bad\":[]}",
            "{\"schema\":1,\"active\":null,\"pending\":\"1.2.4\",\"bad\":[]}",
            "{\"schema\":1,\"active\":null,\"pending\":{\"version\":\"1.2.4\"},\"bad\":[]}",
            "{\"schema\":1,\"active\":null,\"pending\":{\"version\":\"1.2.4\",\"attempts\":-1},\"bad\":[]}",
            "{\"schema\":1,\"active\":null,\"pending\":{\"version\":\"1.2.4\",\"attempts\":true},\"bad\":[]}",
            "{\"schema\":1,\"active\":null,\"pending\":{\"version\":\"01.2.4\",\"attempts\":0},\"bad\":[]}",
            "{\"schema\":1,\"active\":null,\"pending\":null}",
            "{\"schema\":1,\"active\":null,\"pending\":null,\"bad\":[\"1.2.3\",\"x\"]}",
            "{\"schema\":1,\"active\":null,\"pending\":null,\"bad\":\"1.2.3\"}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":null,\"bad\":[]} trailing",
        };
        for (String file : files) {
            assertSame(file, OtaState.EMPTY, OtaState.parse(file.getBytes(StandardCharsets.UTF_8)));
        }
    }

    @Test(expected = IllegalArgumentException.class)
    public void aBundleNameThatIsNotAVersionNeverReachesAState() {
        OtaState.of("../1.2.3", null, 0, NONE);
    }
}
