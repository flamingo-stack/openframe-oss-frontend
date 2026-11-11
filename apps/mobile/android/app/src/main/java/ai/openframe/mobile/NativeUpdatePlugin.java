package ai.openframe.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * The web view's side of over-the-air bundles, the Android twin of
 * ios/App/App/NativeUpdatePlugin.swift: same jsName ("NativeUpdate") and
 * methods, backing the frontend's native-shell.ts. A thin door onto the
 * process singleton {@link NativeUpdate}, which holds every rule.
 *
 * No method takes a path, a URL or a version from the page: which bundle
 * boots and where a new one comes from are the shell's own decisions.
 */
@CapacitorPlugin(name = "NativeUpdate")
public class NativeUpdatePlugin extends Plugin {

    private NativeUpdate update() {
        return NativeUpdate.get(getContext());
    }

    /** The booted bundle reports that it works: a bundle on trial becomes the active one. Resolves {@code {}}. */
    @PluginMethod
    public void notifyReady(PluginCall call) {
        update().notifyReady();
        call.resolve(new JSObject());
    }

    /**
     * Resolves {@code {enabled, builtinVersion, bridgeLevel, bootedVersion, trial,
     * activeVersion, pendingVersion}}; a version is null where there is none
     * ({@code bootedVersion} null: the built-in bundle).
     */
    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(update().state());
    }

    /**
     * Runs a check, joins the one in flight, or is answered from one that has
     * just finished ({@link CheckSchedule} says which), and resolves the state
     * once it has finished, a downloaded bundle included. Never rejects: a check
     * that found, fetched or verified nothing leaves the state as it was.
     */
    @PluginMethod
    public void check(PluginCall call) {
        NativeUpdate update = update();
        update.check("the page asked", () -> call.resolve(update.state()));
    }

    /**
     * Loads the pending bundle now, in this process, as a trial. {@code NO_PENDING} when
     * {@link NativeUpdate#applyPending} has no bundle to hand over.
     */
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
