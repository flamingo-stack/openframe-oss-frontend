import Capacitor
import UIKit
import WebKit

/// Registers app-local plugins with the Capacitor bridge.
/// Wired up via Main.storyboard (custom class of the bridge view controller).
class MainViewController: CAPBridgeViewController {
    /// Held for the controller's lifetime — see `restoreContentInsetAfterFullscreen`.
    private var fullscreenObservation: NSKeyValueObservation?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(NativeFilesPlugin())
        // Native left-edge swipe navigates WKWebView history back/forward. The
        // WebKit back-forward list includes History API (pushState) entries, so
        // this drives the frontend SPA router via popstate. Non-interceptable
        // (unlike the Android back button) — always a history nav, never overlay-aware.
        webView?.allowsBackForwardNavigationGestures = true
        restoreContentInsetAfterFullscreen()
    }

    /// Leaving element fullscreen hands the web view back with its scroll view's
    /// `contentInsetAdjustmentBehavior` reset from the value Capacitor configured
    /// (`.never`) to `.automatic`, and nothing puts it back until a rotation. The
    /// scroll view then insets the page by the safe area, so the LAYOUT VIEWPORT
    /// loses it — measured 874 -> 770pt on an iPhone 17 Pro — while
    /// `env(safe-area-inset-*)` and `NativeAuth.getSafeAreaInsets` keep reporting
    /// the full inset. Everything consuming `--native-safe-*` then pads a second
    /// time inside a viewport that already excludes the band: the app comes back
    /// with a doubled top band and ~84pt of dead space at the bottom.
    ///
    /// It is not fixable from JS — the insets the frontend republishes on exit are
    /// correct reads of a broken viewport. Both fullscreen entry points are
    /// affected: the walkthrough video's Mux player (media-chrome calls
    /// `requestFullscreen()` because Capacitor turns on
    /// `isElementFullscreenEnabled`) and the remote-desktop canvas.
    ///
    /// Restores the CONFIGURED value rather than a hardcoded `.never` so an
    /// `ios.contentInset` in `capacitor.config.ts` keeps working.
    private func restoreContentInsetAfterFullscreen() {
        // `fullscreenState` is iOS 16+. Below that the reset still happens and
        // stays unrepaired; element fullscreen itself needs 15.4.
        guard #available(iOS 16.0, *), let webView = webView else { return }
        let configured = webView.scrollView.contentInsetAdjustmentBehavior
        fullscreenObservation = webView.observe(\.fullscreenState, options: [.new]) { webView, _ in
            guard webView.fullscreenState == .notInFullscreen else { return }
            webView.scrollView.contentInsetAdjustmentBehavior = configured
        }
    }
}
