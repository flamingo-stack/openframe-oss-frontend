package ai.openframe.mobile.ota;

import android.content.res.AssetManager;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Every shared case of apps/mobile/ota/fixtures on the device: its own
 * security provider verifies the signatures (Conscrypt, where the JVM tests
 * run SunEC, which takes a DER signature Conscrypt refuses), and XZ for Java
 * runs on ART. The fixtures are assets of the test APK.
 */
@RunWith(AndroidJUnit4.class)
public class SharedCasesInstrumentedTest {

    private final AssetManager assets = InstrumentationRegistry.getInstrumentation().getContext().getAssets();
    private final SharedCases cases = new SharedCases(assets::open, InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir());

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
