package ai.openframe.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;

import ai.openframe.mobile.ota.OtaSession;
import ai.openframe.mobile.ota.OtaState;

/**
 * The updater's files on a real file system: state.json through AtomicFile,
 * the bundle directories, and what a process does with them from one launch
 * to the next. Each test works in a directory of its own under the app's
 * cache (the tests run as the app), never in the app's ota directory.
 */
@RunWith(AndroidJUnit4.class)
public class UpdateStoreInstrumentedTest {

    private static final String BUILTIN = "1.2.0";
    private static final String ENV = "<script>window.__ENV = {\"NEXT_PUBLIC_SHARED_HOST_URL\":\"https://auth.example\"};</script>";
    private static final String OTHER_ENV = "<script>window.__ENV = {\"NEXT_PUBLIC_SHARED_HOST_URL\":\"https://auth.stage.example\"};</script>";

    private File home;
    private File ota;
    private UpdateStore store;

    @Before
    public void createHome() {
        File cache = InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir();
        home = new File(cache, "update-store-" + System.nanoTime());
        assertTrue(home.mkdirs());
        ota = new File(home, "ota");
        store = new UpdateStore(home);
    }

    @After
    public void deleteHome() {
        delete(home);
    }

    private static void delete(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                delete(child);
            }
        }
        file.delete();
    }

    private static void write(File file, String text) throws IOException {
        File directory = file.getParentFile();
        assertTrue(directory.isDirectory() || directory.mkdirs());
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
        }
    }

    /** A bundle as a check of this build leaves it in the work area, moved into place. */
    private void installBundle(String version) throws IOException {
        installBundle(version, ENV);
    }

    private void installBundle(String version, String envElement) throws IOException {
        File unpacked = new File(store.staging(), version);
        write(new File(unpacked, "index.html"), "<head>" + envElement + "</head>");
        write(new File(unpacked, "_next/static/chunk.js"), "chunk");
        store.install(unpacked, version);
    }

    /** A process of the build whose built-in page carries {@link #ENV}. */
    private static OtaSession session(UpdateStore store) {
        return new OtaSession(BUILTIN, () -> ENV.getBytes(StandardCharsets.UTF_8), store);
    }

    private boolean hasPage(String version) {
        return store.index(version) != null;
    }

    private static OtaState state(String active, String pending, int attempts, String... bad) {
        return OtaState.of(active, pending, attempts, Arrays.asList(bad));
    }

    @Test
    public void aFirstLaunchHasTheEmptyState() throws IOException {
        assertSame(OtaState.EMPTY, store.read());
        assertFalse("reading creates nothing", ota.exists());
    }

    @Test
    public void aWrittenStateIsReadBackByTheNextProcess() throws IOException {
        OtaState written = state("1.2.3", "1.2.4", 1, "1.2.1");

        store.write(written);

        assertEquals(written, new UpdateStore(home).read());
        assertEquals(
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":{\"version\":\"1.2.4\",\"attempts\":1},\"bad\":[\"1.2.1\"]}",
            new String(new android.util.AtomicFile(new File(ota, "state.json")).readFully(), StandardCharsets.UTF_8).trim()
        );
    }

    @Test
    public void aStateFileThatDoesNotParseIsTheEmptyState() throws IOException {
        write(new File(ota, "state.json"), "{\"schema\":1,\"active\":");

        assertSame(OtaState.EMPTY, store.read());
    }

    @Test
    public void aStateThatIsThereButCannotBeReadIsAnErrorNotAnEmptyState() {
        // A directory where the file belongs: it exists, and no read of it succeeds.
        assertTrue(new File(ota, "state.json").mkdirs());

        try {
            store.read();
            fail("an unreadable state was taken for a missing one");
        } catch (IOException expected) {
            OtaSession session = session(store);
            assertNull("the built-in bundle boots", session.boot().version);
            assertFalse(session.isLive());
        }
    }

    @Test
    public void aBundleIsOnThePhoneOnceMovedIntoPlaceWithItsIndex() throws IOException {
        assertFalse(hasPage("1.2.3"));
        assertFalse(session(store).isUsable("1.2.3"));

        installBundle("1.2.3");

        assertTrue(hasPage("1.2.3"));
        assertTrue(session(store).isUsable("1.2.3"));
        assertEquals("<head>" + ENV + "</head>", new String(store.index("1.2.3"), StandardCharsets.UTF_8));
        assertEquals(new File(ota, "bundles/1.2.3"), store.bundleDir("1.2.3"));
        assertTrue(new File(ota, "bundles/1.2.3/_next/static/chunk.js").isFile());
        assertFalse("the work area no longer holds it", new File(ota, "staging/1.2.3").exists());
    }

    @Test
    public void aLeftoverDirectoryWithoutAnIndexIsReplacedByTheNewBundle() throws IOException {
        write(new File(ota, "bundles/1.2.3/stale.js"), "left by an interrupted removal");
        assertFalse(hasPage("1.2.3"));

        installBundle("1.2.3");

        assertTrue(hasPage("1.2.3"));
        assertFalse(new File(ota, "bundles/1.2.3/stale.js").exists());
    }

    @Test
    public void aBundleUnpackedByABuildWithAnotherEnvIsReplacedByTheNewBundle() throws IOException {
        installBundle("1.2.3", OTHER_ENV);
        assertTrue(hasPage("1.2.3"));
        assertFalse("its page is there, with the env of the build before the store update", session(store).isUsable("1.2.3"));

        installBundle("1.2.3");

        assertTrue(session(store).isUsable("1.2.3"));
    }

    @Test
    public void aBundleWithAnotherEnvIsForgottenAtBootAndItsDirectoryGoes() throws IOException {
        installBundle("1.2.3", OTHER_ENV);
        installBundle("1.2.4");
        store.write(state("1.2.3", "1.2.4", 0));

        OtaSession session = session(store);

        assertEquals("1.2.4", session.boot().version);
        assertEquals("dropped, not marked bad", state(null, "1.2.4", 1), store.read());
        store.removeStale(session);
        assertFalse(new File(ota, "bundles/1.2.3").exists());
        assertTrue(session.isUsable("1.2.4"));
    }

    @Test
    public void theWorkAreaIsWipedWhole() throws IOException {
        write(new File(store.staging(), "openframe-mobile-1.2.3.tar.xz"), "half a download");
        write(new File(store.staging(), "1.2.3/a/b/c.js"), "half a bundle");

        store.wipeStaging();

        assertFalse(new File(ota, "staging").exists());
        assertTrue("and can be used again", store.staging().isDirectory());
    }

    @Test
    public void onlyTheDirectoriesTheSessionStillNeedsAreKept() throws IOException {
        for (String version : new String[] {"1.2.1", "1.2.2", "1.2.3", "1.2.4"}) {
            installBundle(version);
        }
        store.write(state("1.2.2", "1.2.3", 0));
        OtaSession session = session(store);
        assertEquals("1.2.3", session.boot().version);
        // The environment moves on while the trial runs: 1.2.4 arrives and takes the pending slot.
        session.downloaded("1.2.4");

        store.removeStale(session);

        assertFalse("neither active, pending nor booted", hasPage("1.2.1"));
        assertTrue("the active bundle", hasPage("1.2.2"));
        assertTrue("the bundle the web view runs from", hasPage("1.2.3"));
        assertTrue("the pending bundle", hasPage("1.2.4"));
    }

    @Test
    public void aTrialIsCountedOnDiskAcrossProcessesAndRevertedAtTheThirdLaunch() throws IOException {
        installBundle("1.2.3");
        installBundle("1.2.4");
        store.write(state("1.2.3", "1.2.4", 0));

        OtaSession first = session(new UpdateStore(home));
        assertEquals("1.2.4", first.boot().version);
        assertEquals("an Activity created again in the same process", "1.2.4", first.recreated().version);
        assertEquals(state("1.2.3", "1.2.4", 1), new UpdateStore(home).read());

        assertEquals("1.2.4", session(new UpdateStore(home)).boot().version);
        assertEquals(state("1.2.3", "1.2.4", 2), new UpdateStore(home).read());

        OtaSession third = session(new UpdateStore(home));
        assertEquals("1.2.3", third.boot().version);
        assertFalse(third.booted().trial);
        assertEquals(state("1.2.3", null, 0, "1.2.4"), new UpdateStore(home).read());

        new UpdateStore(home).removeStale(third);
        assertFalse("the bad bundle's directory goes", hasPage("1.2.4"));
        assertTrue(hasPage("1.2.3"));
    }

    @Test
    public void aBundleWhoseIndexIsGoneFromDiskIsForgottenAtBoot() throws IOException {
        installBundle("1.2.3");
        store.write(state("1.2.3", "1.2.4", 0));

        OtaSession session = session(store);

        assertEquals("1.2.3", session.boot().version);
        assertEquals("dropped, not marked bad", state("1.2.3", null, 0), store.read());
        assertEquals(Collections.emptyList(), store.read().bad);
    }
}
