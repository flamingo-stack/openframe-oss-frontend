package ai.openframe.mobile;

import android.util.AtomicFile;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;

import ai.openframe.mobile.ota.BundleRemoval;
import ai.openframe.mobile.ota.OtaSession;
import ai.openframe.mobile.ota.OtaState;

// Under the no-backup directory: a restored bundle would be one nobody verified on this phone.
final class UpdateStore implements OtaSession.Store {

    private static final String INDEX = "index.html";

    private final File root;
    private final File bundles;
    private final File staging;
    private final AtomicFile state;

    UpdateStore(File noBackupFilesDir) {
        root = new File(noBackupFilesDir, "ota");
        bundles = new File(root, "bundles");
        staging = new File(root, "staging");
        state = new AtomicFile(new File(root, "state.json"));
    }

    @Override
    public OtaState read() throws IOException {
        try {
            return OtaState.parse(state.readFully());
        } catch (FileNotFoundException e) {
            // AtomicFile has put back the file of an interrupted write by now, so no file is a first launch.
            if (!state.getBaseFile().exists()) {
                return OtaState.EMPTY;
            }
            ShellLog.update.error("state.json cannot be read: " + e.getMessage());
            throw e;
        } catch (IOException e) {
            ShellLog.update.error("state.json cannot be read: " + e.getMessage());
            throw e;
        }
    }

    @Override
    public void write(OtaState next) throws IOException {
        FileOutputStream out = null;
        try {
            if (!root.isDirectory() && !root.mkdirs()) {
                throw new IOException("cannot create " + root);
            }
            out = state.startWrite();
            out.write(next.toJson());
            state.finishWrite(out);
        } catch (IOException e) {
            if (out != null) {
                state.failWrite(out);
            }
            ShellLog.update.error("state.json cannot be written: " + e.getMessage());
            throw e;
        }
    }

    @Override
    public byte[] index(String version) {
        File index = new File(bundleDir(version), INDEX);
        try (FileInputStream in = new FileInputStream(index)) {
            byte[] page = new byte[(int) index.length()];
            int filled = 0;
            for (int read; filled < page.length && (read = in.read(page, filled, page.length - filled)) != -1; ) {
                filled += read;
            }
            return filled == page.length ? page : null;
        } catch (IOException e) {
            return null;
        }
    }

    // version is always one that passed the version grammar: digits and dots, never a path.
    File bundleDir(String version) {
        return new File(bundles, version);
    }

    File staging() throws IOException {
        if (!staging.isDirectory() && !staging.mkdirs()) {
            throw new IOException("cannot create " + staging);
        }
        return staging;
    }

    void wipeStaging() {
        BundleRemoval.remove(staging);
    }

    // A rename within one volume, so all of it or none.
    void install(File unpacked, String version) throws IOException {
        File directory = bundleDir(version);
        // Anything already there is not usable (OtaSession.isUsable), or the check would have taken it as it is.
        BundleRemoval.remove(directory);
        if (!bundles.isDirectory() && !bundles.mkdirs() || !unpacked.renameTo(directory)) {
            throw new IOException("cannot move the bundle to " + directory);
        }
    }

    // Never the directory the web view is served from.
    void removeStale(OtaSession session) {
        String[] names = bundles.list();
        if (names == null) {
            return;
        }
        for (String name : session.staleDirectories(Arrays.asList(names))) {
            ShellLog.update.notice("removing bundle directory " + name);
            BundleRemoval.remove(new File(bundles, name));
        }
    }
}
