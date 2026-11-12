package ai.openframe.mobile.ota;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class OtaSessionTest {

    private static final String BUILTIN = "1.2.0";
    private static final List<String> NONE = Collections.emptyList();
    private static final String ENV = "<script>window.__ENV = {\"NEXT_PUBLIC_SHARED_HOST_URL\":\"https://auth.example\"};</script>";
    private static final String OTHER_ENV = "<script>window.__ENV = {\"NEXT_PUBLIC_SHARED_HOST_URL\":\"https://auth.stage.example\"};</script>";

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }

    private static byte[] pageWith(String envElement) {
        return ascii("<!DOCTYPE html><html><head>" + envElement + "<title>OpenFrame</title></head><body></body></html>");
    }

    private static OtaSession session(MemoryStore store) {
        return new OtaSession(BUILTIN, () -> ascii(ENV), store);
    }

    private static final class MemoryStore implements OtaSession.Store {
        OtaState stored = OtaState.EMPTY;
        final Map<String, byte[]> onDisk = new HashMap<>();
        final List<OtaState> writes = new ArrayList<>();
        int reads;
        boolean unreadable;
        boolean unwritable;

        MemoryStore(OtaState stored, String... unpackedByThisBuild) {
            this.stored = stored;
            for (String version : unpackedByThisBuild) {
                onDisk.put(version, pageWith(ENV));
            }
        }

        @Override
        public OtaState read() throws IOException {
            reads++;
            if (unreadable) {
                throw new IOException("the state cannot be read right now");
            }
            return stored;
        }

        @Override
        public void write(OtaState state) throws IOException {
            if (unwritable) {
                throw new IOException("the state cannot be written");
            }
            stored = state;
            writes.add(state);
        }

        @Override
        public byte[] index(String version) {
            return onDisk.get(version);
        }
    }

    private static OtaState state(String active, String pending, int attempts, String... bad) {
        return OtaState.of(active, pending, attempts, Arrays.asList(bad));
    }

    @Test
    public void anActivityRecreationDuringATrialDoesNotCountASecondAttempt() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");
        OtaSession process = session(store);

        OtaSession.Booted first = process.boot();
        OtaSession.Booted recreated = process.recreated();
        OtaSession.Booted recreatedAgain = process.recreated();

        assertEquals("1.2.4", first.version);
        assertTrue(first.trial);
        assertEquals("the recreated Activity runs the same bundle", "1.2.4", recreated.version);
        assertTrue("still on trial", recreated.trial);
        assertEquals("1.2.4", recreatedAgain.version);
        assertEquals("one launch, one attempt", 1, store.stored.attempts);
        assertEquals("the store was read and written once", 1, store.reads);
        assertEquals(1, store.writes.size());
    }

    @Test
    public void anActivityRecreationDoesNotBootABundleDownloadedSinceTheLaunch() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession process = session(store);
        process.boot();
        store.onDisk.put("1.2.4", pageWith(ENV));
        process.downloaded("1.2.4");

        OtaSession.Booted recreated = process.recreated();

        assertEquals("the page is not swapped under a rotation", "1.2.3", recreated.version);
        assertFalse(recreated.trial);
        assertEquals("and the pending bundle has not used an attempt", state("1.2.3", "1.2.4", 0), store.stored);
    }

    @Test
    public void anActivityRestoredIntoANewProcessBootsLikeAColdStart() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");

        OtaSession.Booted restored = session(store).recreated();

        assertEquals("1.2.4", restored.version);
        assertTrue(restored.trial);
        assertEquals("the web view loads it anew, so the attempt counts", state("1.2.3", "1.2.4", 1), store.stored);
    }

    @Test
    public void aFreshStartInTheSameProcessBootsTheBundleDownloadedMeanwhile() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession process = session(store);
        assertEquals("1.2.3", process.boot().version);
        store.onDisk.put("1.2.4", pageWith(ENV));
        process.downloaded("1.2.4");

        OtaSession.Booted relaunched = process.boot();

        assertEquals("1.2.4", relaunched.version);
        assertTrue(relaunched.trial);
        assertEquals(state("1.2.3", "1.2.4", 1), store.stored);
        assertTrue("and its page can confirm it", process.notifyReady());
        assertEquals(state("1.2.4", null, 0), store.stored);
    }

    @Test
    public void aFreshStartOfAnUnconfirmedTrialCountsAnotherAttemptAndTheThirdRevertsIt() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");
        OtaSession process = session(store);

        OtaSession.Booted first = process.boot();
        assertEquals("1.2.4", first.version);
        assertEquals(1, store.stored.attempts);

        OtaSession.Booted second = process.boot();
        assertEquals("1.2.4", second.version);
        assertTrue(second.trial);
        assertNull(second.reverted);
        assertEquals(2, store.stored.attempts);

        OtaSession.Booted third = process.boot();
        assertEquals("the bundle before is back", "1.2.3", third.version);
        assertFalse(third.trial);
        assertEquals("and the launch says which bundle it gave up on", "1.2.4", third.reverted);
        assertEquals(state("1.2.3", null, 0, "1.2.4"), store.stored);
        assertNull("reported once, not at every launch after", process.boot().reverted);
    }

    @Test
    public void aFreshStartAfterADropBootsTheBuiltinBundle() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession process = session(store);
        assertEquals("1.2.3", process.boot().version);
        process.drop();
        assertEquals("the running page keeps its bundle", "1.2.3", process.recreated().version);

        assertNull(process.boot().version);
        assertEquals("its directory may go now", Collections.singletonList("1.2.3"), process.staleDirectories(Collections.singletonList("1.2.3")));
    }

    @Test
    public void aFreshStartReadsTheStateAgainLikeAColdStart() {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        store.unreadable = true;
        OtaSession process = session(store);
        assertNull(process.boot().version);
        assertFalse(process.isLive());

        store.unreadable = false;
        OtaSession.Booted relaunched = process.boot();

        assertEquals("1.2.3", relaunched.version);
        assertTrue(process.isLive());
    }

    @Test
    public void aBundleUnpackedByABuildWithAnotherEnvIsDroppedAndNotMarkedBad() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0));
        store.onDisk.put("1.2.3", pageWith(OTHER_ENV));
        store.onDisk.put("1.2.4", pageWith(OTHER_ENV));

        OtaSession.Booted booted = session(store).boot();

        assertNull("the built-in bundle, which has this build's env, boots", booted.version);
        assertNull(booted.reverted);
        assertEquals("forgotten, so the next check downloads them again", OtaState.EMPTY, store.stored);
    }

    @Test
    public void onlyTheBundleWithThisBuildsEnvBoots() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3");
        store.onDisk.put("1.2.4", pageWith(OTHER_ENV));

        OtaSession.Booted booted = session(store).boot();

        assertEquals("1.2.3", booted.version);
        assertFalse(booted.trial);
        assertEquals(state("1.2.3", null, 0), store.stored);
    }

    @Test
    public void aBundleIsUsableOnlyWithItsPageAndThisBuildsEnvInIt() {
        MemoryStore store = new MemoryStore(OtaState.EMPTY, "1.2.3");
        store.onDisk.put("1.2.4", pageWith(OTHER_ENV));
        store.onDisk.put("1.2.5", pageWith(""));
        OtaSession session = session(store);

        assertTrue(session.isUsable("1.2.3"));
        assertFalse("another build's env", session.isUsable("1.2.4"));
        assertFalse("no env at all", session.isUsable("1.2.5"));
        assertFalse("no index.html", session.isUsable("1.2.6"));
    }

    @Test
    public void aBuildWithoutAnEnvOfItsOwnRunsNoBundle() {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession session = new OtaSession(BUILTIN, () -> null, store);

        assertFalse(session.isUsable("1.2.3"));
        assertNull(session.boot().version);
    }

    @Test
    public void theBuiltinEnvIsNotReadWhileNoBundleIsLookedAt() {
        MemoryStore store = new MemoryStore(state("1.1.0", null, 0), "1.1.0");
        OtaSession session = new OtaSession(BUILTIN, () -> {
            throw new AssertionError("the built-in page was read for a launch with no bundle above the built-in version");
        }, store);

        assertNull(session.boot().version);
    }

    @Test
    public void applyPendingDropsABundleThatCarriesAnotherEnv() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession session = session(store);
        session.boot();
        store.onDisk.put("1.2.4", pageWith(OTHER_ENV));
        session.downloaded("1.2.4");

        OtaSession.Applied applied = session.applyPending();

        assertNull(applied.version);
        assertNull("dropped, not marked bad", applied.reverted);
        assertEquals(state("1.2.3", null, 0), store.stored);
        assertEquals("1.2.3", session.booted().version);
    }

    @Test
    public void aRecreationWhoseBundleLostItsPageRunsTheBuiltinBundleAndItsReadyConfirmsNothing() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");
        OtaSession process = session(store);
        assertEquals("1.2.4", process.boot().version);
        store.onDisk.remove("1.2.4");

        OtaSession.Booted recreated = process.recreated();

        assertNull("the web view loads the built-in bundle", recreated.version);
        assertFalse(recreated.trial);
        assertNull("and that is what the process runs from here on", process.booted().version);
        assertFalse("the built-in page reporting ready confirms no trial", process.notifyReady());
        assertEquals("the state is the next launch's to settle", state("1.2.3", "1.2.4", 1), store.stored);

        assertEquals("1.2.3", process.boot().version);
        assertEquals("dropped, not marked bad", state("1.2.3", null, 0), store.stored);
    }

    @Test
    public void aRecreationWhoseBundleNowCarriesAnotherEnvRunsTheBuiltinBundle() {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession process = session(store);
        assertEquals("1.2.3", process.boot().version);
        store.onDisk.put("1.2.3", pageWith(OTHER_ENV));

        assertNull(process.recreated().version);
        assertNull(process.booted().version);
    }

    @Test
    public void theTrialIsCountedInTheStoreBeforeBootReturns() {
        MemoryStore store = new MemoryStore(state(null, "1.2.4", 0), "1.2.4");

        session(store).boot();

        assertEquals(state(null, "1.2.4", 1), store.stored);
    }

    @Test
    public void aBundleThatNeverReportsReadyIsRevertedAtTheThirdLaunch() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");

        assertEquals("1.2.4", session(store).boot().version);
        assertEquals("1.2.4", session(store).boot().version);
        OtaSession.Booted third = session(store).boot();

        assertEquals("1.2.3", third.version);
        assertFalse(third.trial);
        assertEquals(state("1.2.3", null, 0, "1.2.4"), store.stored);
    }

    @Test
    public void withoutABuiltinVersionNothingIsReadOrWritten() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");
        OtaSession session = new OtaSession(null, () -> ascii(ENV), store);

        OtaSession.Booted booted = session.boot();

        assertNull("the built-in bundle boots", booted.version);
        assertFalse(session.isLive());
        assertEquals(0, store.reads);
        assertTrue(store.writes.isEmpty());
        assertEquals(NONE, session.staleDirectories(Arrays.asList("1.2.3", "1.2.4")));
    }

    @Test
    public void aStateThatCannotBeReadBootsTheBuiltinBundleAndWritesNothingUntilTheNextLaunch() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");
        store.unreadable = true;
        OtaSession session = session(store);

        OtaSession.Booted booted = session.boot();
        store.unreadable = false;
        session.recreated();
        session.notifyReady();
        session.drop();
        session.nothing("1.2.3");
        session.downloaded("1.2.5");
        session.markBad("1.2.5");

        assertNull(booted.version);
        assertNull("the answer holds until the next launch", session.recreated().version);
        assertFalse(session.isLive());
        assertNull(session.applyPending().version);
        assertTrue(store.writes.isEmpty());
        assertEquals("no directory is touched either", NONE, session.staleDirectories(Arrays.asList("1.2.3", "1.2.4")));
        assertEquals("the next process finds the state as it was", state("1.2.3", "1.2.4", 0), store.stored);
    }

    @Test
    public void aTrialThatCannotBeCountedDoesNotBoot() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");
        store.unwritable = true;

        OtaSession.Booted booted = session(store).boot();

        assertEquals("the active bundle boots instead", "1.2.3", booted.version);
        assertFalse(booted.trial);
        assertEquals(state("1.2.3", "1.2.4", 0), store.stored);
    }

    @Test
    public void aTrialThatCannotBeCountedAndHasNoActiveBundleBootsTheBuiltin() {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.4");
        store.unwritable = true;

        OtaSession.Booted booted = session(store).boot();

        assertNull("the active bundle's directory is gone", booted.version);
        assertFalse(booted.trial);
    }

    @Test
    public void readyConfirmsTheTrialThisProcessBooted() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", 0), "1.2.3", "1.2.4");
        OtaSession session = session(store);
        session.boot();

        assertTrue(session.notifyReady());

        assertEquals(state("1.2.4", null, 0), store.stored);
        assertEquals("1.2.4", session.booted().version);
        assertFalse("confirmed, it is no trial any more", session.booted().trial);
        assertEquals("the bundle it replaced may go", Collections.singletonList("1.2.3"), session.staleDirectories(Arrays.asList("1.2.3", "1.2.4")));
        assertFalse("a second report has nothing to confirm", session.notifyReady());
    }

    @Test
    public void readyFromTheActiveOrTheBuiltinBundleWritesNothing() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession session = session(store);
        session.boot();

        assertFalse(session.notifyReady());
        assertTrue(store.writes.isEmpty());
    }

    @Test
    public void readyDoesNotConfirmABundleDownloadedSinceTheBoot() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession session = session(store);
        session.boot();
        store.onDisk.put("1.2.4", pageWith(ENV));
        session.downloaded("1.2.4");

        assertFalse(session.notifyReady());

        assertEquals(state("1.2.3", "1.2.4", 0), store.stored);
    }

    @Test
    public void applyPendingSwitchesToTheDownloadedBundleAsACountedTrial() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession session = session(store);
        session.boot();
        store.onDisk.put("1.2.4", pageWith(ENV));
        session.downloaded("1.2.4");

        assertEquals("1.2.4", session.applyPending().version);

        assertEquals(state("1.2.3", "1.2.4", 1), store.stored);
        assertEquals("1.2.4", session.booted().version);
        assertTrue(session.booted().trial);
        assertEquals("an Activity created again after the switch runs the new bundle", "1.2.4", session.recreated().version);
        assertEquals("without another attempt", 1, store.stored.attempts);
        assertEquals("the bundle it left stays: it is still the active one", Collections.emptyList(), session.staleDirectories(Arrays.asList("1.2.3", "1.2.4")));
        assertTrue("and its page can confirm it", session.notifyReady());
        assertEquals(state("1.2.4", null, 0), store.stored);
    }

    @Test
    public void applyPendingHasNothingToSwitchToWithoutAPendingBundle() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession session = session(store);
        session.boot();

        assertNull(session.applyPending().version);
        assertTrue(store.writes.isEmpty());
    }

    @Test
    public void applyPendingDoesNotCountTheTrialThatIsAlreadyRunning() throws IOException {
        MemoryStore store = new MemoryStore(state(null, "1.2.4", 0), "1.2.4");
        OtaSession session = session(store);
        session.boot();

        assertNull(session.applyPending().version);

        assertEquals(1, store.stored.attempts);
    }

    @Test
    public void applyPendingDropsABundleWhoseIndexIsGone() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3");
        OtaSession session = session(store);
        session.boot();
        session.downloaded("1.2.4");

        assertNull(session.applyPending().version);

        assertEquals(state("1.2.3", null, 0), store.stored);
        assertEquals("1.2.3", session.booted().version);
    }

    @Test
    public void applyPendingSaysWhichBundleItMarkedBadInsteadOfLoadingIt() throws IOException {
        // A trial used up, which the boot could not write down: the active bundle runs with it still pending.
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", OtaState.MAX_TRIAL_ATTEMPTS), "1.2.3", "1.2.4");
        store.unwritable = true;
        OtaSession session = session(store);
        assertEquals("1.2.3", session.boot().version);
        store.unwritable = false;

        OtaSession.Applied applied = session.applyPending();

        assertNull(applied.version);
        assertEquals("1.2.4", applied.reverted);
        assertEquals(state("1.2.3", null, 0, "1.2.4"), store.stored);
        assertEquals("1.2.3", session.booted().version);
    }

    @Test
    public void applyPendingLoadsNothingWhenTheTrialCannotBeCounted() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3", "1.2.4");
        OtaSession session = session(store);
        session.boot();
        session.downloaded("1.2.4");
        store.unwritable = true;

        try {
            session.applyPending();
            fail("the switch went ahead without its attempt counted");
        } catch (IOException expected) {
            assertEquals("1.2.3", session.booted().version);
            assertFalse(session.booted().trial);
        }
    }

    @Test
    public void aCheckDecidesAgainstTheBuiltinVersionAndTheStoredBundles() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0, "1.2.5"), "1.2.3");
        OtaSession session = session(store);
        session.boot();

        assertEquals(Decision.DROP, session.decide(1, "1.2.0", 1));
        assertEquals(Decision.NOTHING, session.decide(1, "1.2.3", 1));
        assertEquals(Decision.NOTHING, session.decide(1, "1.2.5", 1));
        assertEquals(Decision.NOTHING, session.decide(1, "1.2.6", 2));
        assertEquals(Decision.DOWNLOAD, session.decide(1, "1.2.6", 1));

        session.downloaded("1.2.6");
        assertEquals(Decision.NOTHING, session.decide(1, "1.2.6", 1));
    }

    @Test
    public void aDropLeavesTheRunningBundlesDirectoryUntilTheProcessEnds() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", "1.2.4", OtaState.MAX_TRIAL_ATTEMPTS), "1.2.3", "1.2.4");
        OtaSession session = session(store);
        assertEquals("1.2.3", session.boot().version);

        session.drop();

        assertEquals(state(null, null, 0, "1.2.4"), store.stored);
        assertEquals(Collections.singletonList("1.2.4"), session.staleDirectories(Arrays.asList("1.2.3", "1.2.4")));
        assertNull("the next process boots the built-in bundle", session(store).boot().version);
    }

    @Test
    public void aRollbackToTheActiveBundleForgetsAnUnbootedPendingOneButNotARunningTrial() throws IOException {
        MemoryStore store = new MemoryStore(state("1.2.3", null, 0), "1.2.3", "1.2.4");
        OtaSession session = session(store);
        session.boot();
        session.downloaded("1.2.4");

        session.nothing("1.2.3");
        assertEquals(state("1.2.3", null, 0), store.stored);

        session.downloaded("1.2.4");
        assertEquals("1.2.4", session.applyPending().version);
        session.nothing("1.2.3");
        assertEquals("the trial this process runs is left to finish", state("1.2.3", "1.2.4", 1), store.stored);
    }

    @Test
    public void aBundleMarkedBadIsNotDownloadedAgain() throws IOException {
        MemoryStore store = new MemoryStore(OtaState.EMPTY);
        OtaSession session = session(store);
        session.boot();
        assertEquals(Decision.DOWNLOAD, session.decide(1, "1.2.4", 1));

        session.markBad("1.2.4");

        assertEquals(Decision.NOTHING, session.decide(1, "1.2.4", 1));
        OtaSession nextProcess = session(store);
        nextProcess.boot();
        assertEquals(Decision.NOTHING, nextProcess.decide(1, "1.2.4", 1));
    }
}
