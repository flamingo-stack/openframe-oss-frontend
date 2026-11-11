package ai.openframe.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.ServerPath;

import java.io.File;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register app-local plugins before the bridge initializes (mirrors iOS
        // MainViewController.capacitorDidLoad registering NativeAuthPlugin).
        registerPlugin(NativeAuthPlugin.class);
        registerPlugin(NativeFilesPlugin.class);
        registerPlugin(ExternalLinksPlugin.class);
        registerPlugin(NativeUpdatePlugin.class);
        // The web bundle to run, decided before the bridge loads anything: an
        // over-the-air bundle's directory, else the APK's own assets (mirrors iOS
        // MainViewController.instanceDescriptor). A saved state means the system is
        // creating the Activity again, which keeps the bundle it ran; without one this
        // is a launch, also in a process that outlived the last Activity (after Back).
        File bundle = NativeUpdate.get(this).bootDirectory(savedInstanceState != null);
        if (bundle != null) {
            bridgeBuilder.setServerPath(new ServerPath(ServerPath.PathType.BASE_PATH, bundle.getPath()));
        }
        super.onCreate(savedInstanceState);
    }
}
