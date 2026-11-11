package ai.openframe.mobile.ota;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.junit.Assume.assumeTrue;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class DirectorySinkTest {

    @Rule
    public final TemporaryFolder disk = new TemporaryFolder();

    private static InputStream fixture(String path) {
        return DirectorySinkTest.class.getResourceAsStream("/" + path);
    }

    private static byte[] read(InputStream stream) throws IOException {
        try (InputStream in = stream) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[1024];
            for (int read; (read = in.read(chunk)) != -1; ) {
                out.write(chunk, 0, read);
            }
            return out.toByteArray();
        }
    }

    private static List<String> filesUnder(File directory) {
        List<String> files = new ArrayList<>();
        collect(directory, "", files);
        Collections.sort(files);
        return files;
    }

    private static void collect(File directory, String prefix, List<String> into) {
        for (File child : directory.listFiles()) {
            if (child.isDirectory()) {
                collect(child, prefix + child.getName() + "/", into);
            } else {
                into.add(prefix + child.getName());
            }
        }
    }

    @Test
    public void aBundleUnpacksToTheFilesItsCaseLists() throws Exception {
        File unpacked = disk.newFolder("staging", "1.2.3");
        byte[] index;
        try (InputStream in = fixture("bundles/typical.tar.xz"); DirectorySink sink = new DirectorySink(unpacked)) {
            index = BundleReader.read(in, sink);
        }

        List<?> cases = (List<?>) Json.parseObject(read(fixture("bundle-cases.json"))).get("cases");
        Map<?, ?> typical = (Map<?, ?>) cases.get(0);
        assertEquals("bundles/typical.tar.xz", typical.get("bundle"));
        List<String> expected = new ArrayList<>();
        for (Object each : (List<?>) ((Map<?, ?>) typical.get("expect")).get("files")) {
            Map<?, ?> file = (Map<?, ?>) each;
            String path = (String) file.get("path");
            expected.add(path);
            byte[] onDisk = read(new FileInputStream(new File(unpacked, path)));
            assertEquals(path, file.get("size").toString(), String.valueOf(onDisk.length));
            assertEquals(path, file.get("sha256"), Bytes.hex(Bytes.sha256().digest(onDisk)));
        }
        Collections.sort(expected);
        assertEquals("nothing else was written", expected, filesUnder(unpacked));
        assertArrayEquals(index, read(new FileInputStream(new File(unpacked, "index.html"))));
    }

    @Test
    public void theBuiltinEnvGoesIntoTheUnpackedRootPage() throws Exception {
        File unpacked = disk.newFolder("1.2.3");
        byte[] index;
        try (InputStream in = fixture("bundles/typical.tar.xz"); DirectorySink sink = new DirectorySink(unpacked)) {
            index = BundleReader.read(in, sink);
        }
        byte[] builtin = "<html><head><script>window.__ENV = {\"NEXT_PUBLIC_SHARED_HOST_URL\":\"https://auth.example\"};</script></head></html>"
            .getBytes(StandardCharsets.UTF_8);

        String page = new String(EnvCopy.insert(EnvCopy.element(builtin), index), StandardCharsets.UTF_8);

        String element = "<script>window.__ENV = {\"NEXT_PUBLIC_SHARED_HOST_URL\":\"https://auth.example\"};</script>";
        assertTrue(page, page.contains("<head>" + element));
        assertEquals("exactly the element was added", new String(index, StandardCharsets.UTF_8), page.replace(element, ""));
    }

    @Test
    public void aRefusedBundleWritesNothingOutsideItsDirectory() throws Exception {
        String[] refused = {
            "bundles/name-parent.tar.xz",
            "bundles/name-parent-in-prefix.tar.xz",
            "bundles/name-absolute.tar.xz",
            "bundles/symlink.tar.xz",
            "bundles/hard-link.tar.xz",
            "bundles/directory.tar.xz",
            "bundles/file-then-directory.tar.xz",
            "bundles/directory-then-file.tar.xz",
        };
        for (String bundle : refused) {
            File work = disk.newFolder();
            File unpacked = new File(work, "1.2.3");
            assertTrue(unpacked.mkdir());
            try (InputStream in = fixture(bundle); DirectorySink sink = new DirectorySink(unpacked)) {
                BundleReader.read(in, sink);
                fail(bundle + " was unpacked");
            } catch (OtaError e) {
                assertTrue(bundle + ": " + e.code, e.isContentRefusal());
            }
            assertEquals(bundle, Arrays.asList("1.2.3"), Arrays.asList(work.list()));
            for (String written : filesUnder(unpacked)) {
                assertFalse(bundle + " wrote " + written, written.contains("evil"));
            }
        }
    }

    private static int openFiles() {
        return new File("/dev/fd").list().length;
    }

    @Test
    public void aSinkClosedHalfwayThroughAFileReleasesIt() throws Exception {
        assumeTrue("no /dev/fd to count this process's open files in", new File("/dev/fd").list() != null);
        // Once before any count: a first use loads classes, and the class loader keeps the jars it opens for them.
        try (DirectorySink first = new DirectorySink(disk.newFolder())) {
            first.begin("first.js", 1);
        }
        File unpacked = disk.newFolder("1.2.3");
        int before = openFiles();
        DirectorySink sink = new DirectorySink(unpacked);
        sink.begin("a/b/half.js", 10);
        sink.write(new byte[] {1, 2, 3}, 0, 3);
        assertEquals("the file is held open while the reader writes it", before + 1, openFiles());

        sink.close();

        assertEquals("the process no longer holds the file", before, openFiles());
        sink.close();
        assertEquals("a second close has nothing to release", before, openFiles());
        assertEquals(3, new File(unpacked, "a/b/half.js").length());
    }
}
