package ai.openframe.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

// The Android twin of ios/App/App/NativeUpdatePlugin.swift: same jsName ("NativeUpdate") and methods,
// backing the frontend's native-shell.ts.
//
// No method takes a path, a URL or a version from the page: which bundle boots and where a new one
// comes from are the shell's own decisions.
@CapacitorPlugin(name = "NativeUpdate")
public class NativeUpdatePlugin extends Plugin {

    private NativeUpdate update() {
        return NativeUpdate.get(getContext());
    }

    @PluginMethod
    public void notifyReady(PluginCall call) {
        update().notifyReady();
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(update().state());
    }

    // Never rejects: a check that found, fetched or verified nothing leaves the state as it was.
    @PluginMethod
    public void check(PluginCall call) {
        NativeUpdate update = update();
        update.check("the page asked", () -> call.resolve(update.state()));
    }

    @PluginMethod
    public void applyPending(PluginCall call) {
        File directory = update().applyPending();
        if (directory == null) {
            call.reject("There is no pending bundle to apply", "NO_PENDING");
            return;
        }
        call.resolve();
        bridge.executeOnMainThread(() -> bridge.setServerBasePath(directory.getPath()));
    }
}
