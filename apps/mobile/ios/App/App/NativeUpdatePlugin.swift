import Capacitor
import Foundation

/**
 * Local Capacitor plugin backing the frontend's `NativeUpdate` bridge
 * (openframe-frontend: src/lib/native-shell.ts), mirrored on Android by
 * `NativeUpdatePlugin.java` (same jsName + method surface).
 *
 * No method takes a path, a URL or a version: a page script, which also
 * renders remote Help Center and chat content, can ask what is installed and
 * when to look or restart, never what to install or from where.
 */
@objc(NativeUpdatePlugin)
public class NativeUpdatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeUpdatePlugin"
    public let jsName = "NativeUpdate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "notifyReady", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "check", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "applyPending", returnType: CAPPluginReturnPromise)
    ]

    @objc func notifyReady(_ call: CAPPluginCall) {
        NativeUpdate.shared.notifyReady { call.resolve() }
    }

    @objc func getState(_ call: CAPPluginCall) {
        NativeUpdate.shared.snapshot { call.resolve($0.json) }
    }

    @objc func check(_ call: CAPPluginCall) {
        NativeUpdate.shared.check { call.resolve($0.json) }
    }

    @objc func applyPending(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Looked up before the updater commits to the bundle: without the
            // bridge's view controller there is no web view to move onto it.
            guard let controller = self.bridge?.viewController as? CAPBridgeViewController else {
                call.reject("The web view is not available", "UNAVAILABLE")
                return
            }
            NativeUpdate.shared.applyPending { directory in
                guard let directory else {
                    call.reject("No pending bundle to apply", "NO_PENDING")
                    return
                }
                DispatchQueue.main.async {
                    call.resolve()
                    controller.setServerBasePath(path: directory.path)
                }
            }
        }
    }
}
