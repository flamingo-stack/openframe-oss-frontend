import Capacitor
import UIKit

/// Registers app-local plugins with the Capacitor bridge.
/// Wired up via Main.storyboard (custom class of the bridge view controller).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(NativeFilesPlugin())
        // Native left-edge swipe navigates WKWebView history back/forward. The
        // WebKit back-forward list includes History API (pushState) entries, so
        // this drives the frontend SPA router via popstate. Non-interceptable
        // (unlike the Android back button) — always a history nav, never overlay-aware.
        webView?.allowsBackForwardNavigationGestures = true
    }
}
