package ai.openframe.mobile.ota;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/**
 * Every shared case of apps/mobile/ota/fixtures on the JVM, where the
 * signature verifier is SunEC. On a phone it is Conscrypt, and
 * SharedCasesInstrumentedTest runs the same cases there.
 */
public class SharedCasesTest {

    @Rule
    public final TemporaryFolder disk = new TemporaryFolder();

    private SharedCases cases;

    @Before
    public void readFixturesFromResources() {
        cases = new SharedCases(path -> SharedCasesTest.class.getResourceAsStream("/" + path), disk.getRoot());
    }

    @Test
    public void manifestCases() throws Exception {
        cases.manifestCases();
    }

    @Test
    public void bundleCases() throws Exception {
        cases.bundleCases();
    }

    @Test
    public void envCases() throws Exception {
        cases.envCases();
    }

    @Test
    public void decisionCases() throws Exception {
        cases.decisionCases();
    }

    @Test
    public void keyIds() throws Exception {
        cases.keyIds();
    }
}
