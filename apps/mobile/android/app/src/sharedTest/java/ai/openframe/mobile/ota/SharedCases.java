package ai.openframe.mobile.ota;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Runs the cases of apps/mobile/ota/fixtures, which the release scripts and
 * both shells must agree on (apps/mobile/docs/ota.md, "Shared test cases"),
 * against this shell's format code. Each case is an input and its outcome:
 * what is accepted, or the code of the first check that refuses it.
 *
 * One runner for two places: the JVM tests read the fixtures as resources,
 * the on-device tests as assets, where the security provider and the runtime
 * are the phone's own. A method fails once, naming every case that went wrong.
 */
public final class SharedCases {

    /** Opens a file of the fixtures directory by its path in it, {@code bundles/typical.tar.xz}. */
    public interface Fixtures {
        InputStream open(String path) throws IOException;
    }

    private final Fixtures fixtures;
    private final File workDirectory;

    /** @param workDirectory where a bundle case is put as the file a download would leave; each is deleted after its case */
    public SharedCases(Fixtures fixtures, File workDirectory) {
        this.fixtures = fixtures;
        this.workDirectory = workDirectory;
    }

    public void manifestCases() throws Exception {
        Map<?, ?> keys = (Map<?, ?>) Json.parseObject(read("fixture-keys.json")).get("keys");
        List<String> failures = new ArrayList<>();
        List<?> cases = cases("manifest-cases.json");
        for (Object each : cases) {
            Map<?, ?> testCase = (Map<?, ?>) each;
            List<byte[]> held = new ArrayList<>();
            for (Object name : (List<?>) testCase.get("keys")) {
                held.add(spki((Map<?, ?>) keys.get(name)));
            }
            Map<String, PublicKey> shellKeys = OtaKeys.of(held.toArray(new byte[0][]));
            String outcome;
            try {
                Manifest.Payload payload = Manifest.verify(utf8((String) testCase.get("manifest")), shellKeys);
                outcome = "payload 1 " + payload.version + " " + payload.bridgeLevel + " " + payload.url + " " + payload.size + " " + payload.sha256;
            } catch (OtaError e) {
                outcome = "error " + e.code;
            }
            Map<?, ?> expect = (Map<?, ?>) testCase.get("expect");
            String expected;
            if (expect.containsKey("error")) {
                expected = "error " + expect.get("error");
            } else {
                Map<?, ?> payload = (Map<?, ?>) expect.get("payload");
                expected = "payload " + payload.get("format") + " " + payload.get("version") + " " + payload.get("bridgeLevel") + " "
                    + payload.get("url") + " " + payload.get("size") + " " + payload.get("sha256");
            }
            compare(failures, testCase, expected, outcome);
        }
        assertAllPassed("manifest", cases, failures);
    }

    public void bundleCases() throws Exception {
        List<String> failures = new ArrayList<>();
        List<?> cases = cases("bundle-cases.json");
        for (Object each : cases) {
            Map<?, ?> testCase = (Map<?, ?>) each;
            byte[] archive = read((String) testCase.get("bundle"));
            long size = integer(testCase.get("size"));
            String sha256 = (String) testCase.get("sha256");
            Map<?, ?> expect = (Map<?, ?>) testCase.get("expect");
            String expected;
            if (expect.containsKey("error")) {
                expected = "error " + expect.get("error");
            } else {
                StringBuilder files = new StringBuilder("files");
                for (Object each2 : (List<?>) expect.get("files")) {
                    Map<?, ?> file = (Map<?, ?>) each2;
                    files.append('\n').append(file.get("path")).append(' ').append(file.get("size")).append(' ').append(file.get("sha256"));
                }
                expected = files.toString();
            }
            compare(failures, testCase, expected, downloadedOutcome(archive, size, sha256));
            // The reader's own refusals again, with a few bytes per read, as a slow disk or a decoder may
            // hand them out. Size and hash are not its to refuse.
            if (!expected.equals("error SIZE") && !expected.equals("error SHA256")) {
                compare(failures, testCase, expected, readerOutcome(new Trickle(new ByteArrayInputStream(archive), 7)));
            }
        }
        assertAllPassed("bundle", cases, failures);
    }

    /** What the app does with a downloaded bundle, through the one function it does it with. */
    private String downloadedOutcome(byte[] archive, long size, String sha256) throws IOException {
        File downloaded = File.createTempFile("bundle-case", ".tar.xz", workDirectory);
        try {
            try (OutputStream out = new FileOutputStream(downloaded)) {
                out.write(archive);
            }
            HashingSink sink = new HashingSink();
            BundleReader.readVerified(downloaded, size, sha256, sink);
            return sink.files.toString();
        } catch (OtaError e) {
            return "error " + e.code;
        } finally {
            downloaded.delete();
        }
    }

    private static String readerOutcome(InputStream archive) throws IOException {
        HashingSink sink = new HashingSink();
        try {
            BundleReader.read(archive, sink);
            return sink.files.toString();
        } catch (OtaError e) {
            return "error " + e.code;
        }
    }

    public void envCases() throws Exception {
        List<String> failures = new ArrayList<>();
        List<?> cases = cases("env-cases.json");
        for (Object each : cases) {
            Map<?, ?> testCase = (Map<?, ?>) each;
            String outcome;
            try {
                byte[] html = EnvCopy.copy(utf8((String) testCase.get("builtin")), utf8((String) testCase.get("staged")));
                outcome = "html " + new String(html, StandardCharsets.UTF_8);
            } catch (OtaError e) {
                outcome = "error " + e.code;
            }
            Map<?, ?> expect = (Map<?, ?>) testCase.get("expect");
            compare(failures, testCase, expect.containsKey("error") ? "error " + expect.get("error") : "html " + expect.get("html"), outcome);
        }
        assertAllPassed("env", cases, failures);
    }

    public void decisionCases() throws Exception {
        List<String> failures = new ArrayList<>();
        List<?> cases = cases("decision-cases.json");
        for (Object each : cases) {
            Map<?, ?> testCase = (Map<?, ?>) each;
            Map<?, ?> shell = (Map<?, ?>) testCase.get("shell");
            Map<?, ?> bundles = (Map<?, ?>) testCase.get("bundles");
            Map<?, ?> payload = (Map<?, ?>) testCase.get("payload");
            List<String> bad = new ArrayList<>();
            for (Object version : (List<?>) bundles.get("bad")) {
                bad.add((String) version);
            }
            OtaState state = OtaState.of(stringOrNull(bundles.get("active")), stringOrNull(bundles.get("pending")), 0, bad);
            Decision decision = Decision.decide(
                (String) shell.get("builtinVersion"),
                (int) integer(shell.get("bridgeLevel")),
                state,
                (String) payload.get("version"),
                (int) integer(payload.get("bridgeLevel"))
            );
            compare(failures, testCase, (String) testCase.get("expect"), decision.name().toLowerCase(Locale.ROOT));
        }
        assertAllPassed("decision", cases, failures);
    }

    /** Each fixture key's id, worked out from its SPKI DER as the shell works out the ids of the keys it holds. */
    public void keyIds() throws Exception {
        Map<?, ?> keys = (Map<?, ?>) Json.parseObject(read("fixture-keys.json")).get("keys");
        assertTrue("fixture-keys.json holds keys", keys.size() > 0);
        for (Object each : keys.values()) {
            Map<?, ?> key = (Map<?, ?>) each;
            byte[] spki = spki(key);
            assertEquals(key.get("keyId"), OtaKeys.keyId(spki));
            assertTrue(OtaKeys.of(spki).containsKey((String) key.get("keyId")));
        }
    }

    private List<?> cases(String file) throws Exception {
        return (List<?>) Json.parseObject(read(file)).get("cases");
    }

    private static void compare(List<String> failures, Map<?, ?> testCase, String expected, String actual) {
        if (!expected.equals(actual)) {
            failures.add("\n" + testCase.get("name") + "\n  expected: " + expected + "\n  actual:   " + actual);
        }
    }

    private static void assertAllPassed(String kind, List<?> cases, List<String> failures) {
        assertTrue("no " + kind + " cases were read", cases.size() > 0);
        assertTrue(failures.size() + " of " + cases.size() + " " + kind + " cases failed:" + failures, failures.isEmpty());
    }

    private static String stringOrNull(Object value) {
        return value == Json.NULL ? null : (String) value;
    }

    /** A whole number of a fixture, which is this repository's own file. */
    private static long integer(Object number) {
        return Long.parseLong(((Json.Num) number).text);
    }

    private static byte[] utf8(String text) {
        return text.getBytes(StandardCharsets.UTF_8);
    }

    /** The DER inside a PEM public key. */
    private static byte[] spki(Map<?, ?> key) {
        StringBuilder base64 = new StringBuilder();
        for (String line : ((String) key.get("publicKey")).split("\n")) {
            if (!line.startsWith("-----")) {
                base64.append(line.trim());
            }
        }
        byte[] der = Base64Strict.decode(base64.toString());
        assertTrue("a fixture key that is not base64", der != null);
        return der;
    }

    private byte[] read(String path) throws IOException {
        try (InputStream in = fixtures.open(path)) {
            assertTrue("fixture " + path + " is missing", in != null);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[8 * 1024];
            for (int read; (read = in.read(chunk)) != -1; ) {
                out.write(chunk, 0, read);
            }
            return out.toByteArray();
        }
    }

    /** An input that never gives more than a few bytes per read. */
    private static final class Trickle extends FilterInputStream {
        private final int bytesPerRead;

        Trickle(InputStream in, int bytesPerRead) {
            super(in);
            this.bytesPerRead = bytesPerRead;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            return super.read(buffer, offset, Math.min(length, bytesPerRead));
        }
    }

    /** Takes a bundle's files as {@code path size sha256} lines, in archive order: what the cases list. */
    private static final class HashingSink implements BundleReader.Sink {
        final StringBuilder files = new StringBuilder("files");
        private MessageDigest digest;
        private String path;
        private long declared;
        private long written;

        @Override
        public void begin(String path, long size) {
            this.path = path;
            declared = size;
            written = 0;
            digest = Bytes.sha256();
        }

        @Override
        public void write(byte[] buffer, int offset, int length) {
            digest.update(buffer, offset, length);
            written += length;
        }

        @Override
        public void end() {
            assertEquals("bytes written for " + path, declared, written);
            files.append('\n').append(path).append(' ').append(written).append(' ').append(Bytes.hex(digest.digest()));
        }
    }
}
