package ai.openframe.mobile.ota;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class BundleRemovalTest {

    @Rule
    public final TemporaryFolder disk = new TemporaryFolder();

    private static void write(File file) throws IOException {
        File directory = file.getParentFile();
        assertTrue(directory.isDirectory() || directory.mkdirs());
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write('x');
        }
    }

    // Files that sort before and after the root page, at the root and below it.
    private File bundle() throws IOException {
        File bundle = new File(disk.getRoot(), "1.2.3");
        for (String path : new String[] {"404.html", "_next/static/chunks/a.js", "assets/logo.svg", "devices/index.html", "index.html", "index.txt", "zz/z.js"}) {
            write(new File(bundle, path));
        }
        return bundle;
    }

    @Test
    public void theRootPageIsDeletedBeforeAnythingElse() throws IOException {
        File bundle = bundle();

        List<File> order = BundleRemoval.order(bundle);

        assertEquals(new File(bundle, "index.html"), order.get(0));
        assertEquals("the directory itself goes last", bundle, order.get(order.size() - 1));
        assertTrue("the page of a route is a file like any other", order.indexOf(new File(bundle, "devices/index.html")) > 0);
    }

    @Test
    public void everyFileAndDirectoryIsDeletedOnceAndADirectoryAfterWhatItHolds() throws IOException {
        File bundle = bundle();

        List<File> order = BundleRemoval.order(bundle);

        Set<File> seen = new HashSet<>();
        for (File each : order) {
            assertTrue(each + " twice", seen.add(each));
            File[] children = each.listFiles();
            if (children != null) {
                for (File child : children) {
                    assertTrue(each + " before " + child, seen.contains(child));
                }
            }
        }
        assertEquals("7 files, 7 directories", 14, order.size());
    }

    @Test
    public void aRemovalStoppedAfterItsFirstStepHasTakenTheRootPage() throws IOException {
        File bundle = bundle();
        List<File> order = BundleRemoval.order(bundle);

        assertTrue(order.get(0).delete());

        assertFalse(new File(bundle, "index.html").exists());
        assertTrue("the rest is still there, for the next removal", new File(bundle, "_next/static/chunks/a.js").isFile());
        BundleRemoval.remove(bundle);
        assertFalse(bundle.exists());
    }

    @Test
    public void aBundleIsRemovedWhole() throws IOException {
        File bundle = bundle();
        File sibling = new File(disk.getRoot(), "1.2.4/index.html");
        write(sibling);

        BundleRemoval.remove(bundle);

        assertFalse(bundle.exists());
        assertTrue("and nothing beside it", sibling.isFile());
    }

    @Test
    public void aDirectoryWithoutARootPageOrThatIsNotThereIsRemovedAllTheSame() throws IOException {
        File leftover = new File(disk.getRoot(), "1.2.5");
        write(new File(leftover, "_next/static/chunks/a.js"));

        BundleRemoval.remove(leftover);
        BundleRemoval.remove(new File(disk.getRoot(), "never-there"));

        assertFalse(leftover.exists());
    }
}
