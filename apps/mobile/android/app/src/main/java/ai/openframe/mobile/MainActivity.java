package ai.openframe.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register app-local plugins before the bridge initializes (mirrors iOS
        // MainViewController.capacitorDidLoad registering NativeAuthPlugin).
        registerPlugin(NativeAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
