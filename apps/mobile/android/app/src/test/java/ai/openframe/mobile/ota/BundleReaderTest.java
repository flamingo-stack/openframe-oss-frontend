package ai.openframe.mobile.ota;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * What the shared cases cannot say about the bundle reader: a disk that fails
 * is not a bad bundle (marking a release bad for it would keep a phone off
 * that release for good), and a downloaded file that is not the signed one is
 * refused before a byte of it is decoded.
 */
public class BundleReaderTest {

    @Rule
    public final TemporaryFolder disk = new TemporaryFolder();

    /** Fails the test at the first file: nothing may be decoded into it. */
    private static final BundleReader.Sink UNTOUCHED = new BundleReader.Sink() {
        @Override
        public void begin(String path, long size) {
            fail("a file of the bundle was decoded: " + path);
        }

        @Override
        public void write(byte[] buffer, int offset, int length) {
        }

        @Override
        public void end() {
        }
    };

    private File downloaded(byte[] bytes) throws IOException {
        File file = disk.newFile();
        try (OutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return file;
    }

    private static OtaError.Code refusalOf(File archive, long size, String sha256) throws IOException {
        try {
            BundleReader.readVerified(archive, size, sha256, UNTOUCHED);
            throw new AssertionError("the file was read");
        } catch (OtaError e) {
            return e.code;
        }
    }

    private static final BundleReader.Sink DISCARD = new BundleReader.Sink() {
        @Override
        public void begin(String path, long size) {
        }

        @Override
        public void write(byte[] buffer, int offset, int length) {
        }

        @Override
        public void end() {
        }
    };

    private static byte[] typicalBundle() throws IOException {
        try (InputStream in = BundleReaderTest.class.getResourceAsStream("/bundles/typical.tar.xz")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[1024];
            for (int read; (read = in.read(chunk)) != -1; ) {
                out.write(chunk, 0, read);
            }
            return out.toByteArray();
        }
    }

    @Test
    public void aFailingSinkIsAnIoErrorNotARefusal() throws Exception {
        IOException diskFull = new IOException("no space left on device");
        BundleReader.Sink failing = new BundleReader.Sink() {
            @Override
            public void begin(String path, long size) {
            }

            @Override
            public void write(byte[] buffer, int offset, int length) throws IOException {
                throw diskFull;
            }

            @Override
            public void end() {
            }
        };

        try {
            BundleReader.read(new ByteArrayInputStream(typicalBundle()), failing);
            fail("the bundle was read into a sink that takes nothing");
        } catch (IOException e) {
            assertSame(diskFull, e);
        }
    }

    @Test
    public void anArchiveFileThatFailsToReadIsAnIoErrorNotAnXzRefusal() throws Exception {
        byte[] bundle = typicalBundle();
        IOException readError = new IOException("I/O error");
        InputStream failsHalfway = new InputStream() {
            private int at;

            @Override
            public int read() throws IOException {
                if (at >= bundle.length / 2) {
                    throw readError;
                }
                return bundle[at++] & 0xff;
            }
        };

        try {
            BundleReader.read(failsHalfway, DISCARD);
            fail("half a bundle was read");
        } catch (IOException e) {
            assertSame(readError, e);
        }
    }

    @Test
    public void anArchiveThatEndsHalfwayIsAnXzRefusal() throws Exception {
        byte[] bundle = typicalBundle();

        try {
            BundleReader.read(new ByteArrayInputStream(bundle, 0, bundle.length / 2), DISCARD);
            fail("half a bundle was read");
        } catch (OtaError e) {
            assertEquals(OtaError.Code.XZ, e.code);
        }
    }

    @Test
    public void aDownloadedFileIsDecodedOnlyOnceItsSizeAndHashAreTheSignedOnes() throws Exception {
        byte[] bundle = typicalBundle();
        String sha256 = Bytes.hex(Bytes.sha256().digest(bundle));
        String otherSha256 = Bytes.hex(Bytes.sha256().digest(new byte[0]));
        File archive = downloaded(bundle);
        byte[] cutShort = new byte[bundle.length - 1];
        System.arraycopy(bundle, 0, cutShort, 0, cutShort.length);

        assertEquals(OtaError.Code.SHA256, refusalOf(archive, bundle.length, otherSha256));
        assertEquals(OtaError.Code.SIZE, refusalOf(archive, bundle.length + 1, sha256));
        assertEquals(OtaError.Code.SIZE, refusalOf(archive, bundle.length - 1, sha256));
        assertEquals("the size is looked at before the hash", OtaError.Code.SIZE, refusalOf(archive, bundle.length + 1, otherSha256));
        assertEquals("a download cut short is its size's fault, not the stream's", OtaError.Code.SIZE, refusalOf(downloaded(cutShort), bundle.length, sha256));

        int[] files = {0};
        byte[] index = BundleReader.readVerified(archive, bundle.length, sha256, new BundleReader.Sink() {
            @Override
            public void begin(String path, long size) {
                files[0]++;
            }

            @Override
            public void write(byte[] buffer, int offset, int length) {
            }

            @Override
            public void end() {
            }
        });
        assertTrue("the signed file is decoded", files[0] > 0);
        assertArrayEquals(BundleReader.read(new ByteArrayInputStream(bundle), DISCARD), index);
    }

    @Test
    public void theReaderReturnsTheRootPageTheEnvIsCopiedInto() throws Exception {
        byte[] index = BundleReader.read(new ByteArrayInputStream(typicalBundle()), DISCARD);

        assertEquals(111, index.length);
        EnvCopy.assertTarget(index);
    }
}
