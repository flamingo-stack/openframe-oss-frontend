import Capacitor
import SafariServices
import UIKit
import WebKit

/**
 * Opens external web pages in an in-app browser (SFSafariViewController) instead
 * of Safari. Capacitor asks every plugin before applying its own policy, whose
 * fallback for an off-origin top-level navigation is `UIApplication.open`, i.e.
 * Safari. Mirrored on Android by `ExternalLinksPlugin.java` (Custom Tabs).
 *
 * Still left to the system: store pages, links an installed app claims (universal
 * links), and every non-web scheme (`mailto:`, `tel:`, the update screen's
 * `itms-apps:`), which SFSafariViewController cannot open anyway. Subframe loads
 * (embedded players) are never touched. While a browser is up the plugin also
 * reports the app inactive through `@capacitor/app`'s event (see `browser`).
 */
@objc(ExternalLinksPlugin)
public class ExternalLinksPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalLinksPlugin"
    public let jsName = "ExternalLinks"
    public let pluginMethods: [CAPPluginMethod] = []

    /// In an in-app browser these render as a web page; Safari hands them to the App
    /// Store. Must cover the host of `APP_STORE_URL` in
    /// `apps/web/src/lib/mobile-app-links.ts`: the update screen's https fallback
    /// arrives here through `location.assign`. Kept identical to Android's
    /// `SYSTEM_HOSTS`; the other platform's store renders as a web page either way.
    private static let systemHosts: Set<String> = ["apps.apple.com", "itunes.apple.com", "play.google.com"]

    /// The browser on screen: the one record of whether one is up. While it is, the web
    /// layer is told the app is inactive (apps/mobile CLAUDE.md, "SFSafariViewController
    /// never resigns the app active").
    private weak var browser: SFSafariViewController?
    private var activationObserver: NSObjectProtocol?

    deinit {
        if let activationObserver {
            NotificationCenter.default.removeObserver(activationObserver)
        }
    }

    override public func load() {
        // `@capacitor/app` reports every activation as active, a return from the
        // background with the browser still up included, so report inactive again. Its
        // observer is registered first (bridge init, before `capacitorDidLoad`), so the
        // inline send reaches JS right after its `true`; the deferred one is the
        // backstop should that order ever change.
        activationObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard self?.browser != nil else {
                return
            }
            self?.reportAppState(isActive: false)
            DispatchQueue.main.async {
                if self?.browser != nil {
                    self?.reportAppState(isActive: false)
                }
            }
        }
    }

    /// The top-level test here and the off-origin test in `open(_:)` repeat Capacitor's
    /// own fallback in `WebViewDelegationHandler.webView(_:decidePolicyFor:decisionHandler:)`,
    /// which exposes no predicate: re-check both on a Capacitor bump.
    override public func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        let topLevel = navigationAction.targetFrame == nil || navigationAction.targetFrame?.isMainFrame == true
        guard topLevel, let url = navigationAction.request.url, open(url) else {
            return nil
        }
        return true
    }

    /// Takes `url` when it is an external web page; `false` leaves it to Capacitor.
    func open(_ url: URL) -> Bool {
        guard let bridge,
              let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = url.host?.lowercased(), !Self.systemHosts.contains(host),
              !bridge.config.shouldAllowNavigation(to: host),
              !url.absoluteString.hasPrefix(bridge.config.serverURL.absoluteString),
              !url.absoluteString.hasPrefix(bridge.config.localURL.absoluteString) else {
            return false
        }
        // Capacitor drops a background navigation too rather than opening it.
        guard UIApplication.shared.applicationState == .active else {
            return true
        }
        UIApplication.shared.open(url, options: [.universalLinksOnly: true]) { [weak self] openedInApp in
            if !openedInApp {
                self?.present(url)
            }
        }
        return true
    }

    private func present(_ url: URL) {
        // A second link landing while a browser is up (a double tap) does not stack another.
        guard browser == nil, var top = bridge?.viewController else {
            return
        }
        while let presented = top.presentedViewController, !presented.isBeingDismissed {
            top = presented
        }
        let browser = SFSafariViewController(url: url)
        browser.delegate = self
        top.present(browser, animated: true)
        // UIKit refuses a present while `top` is mid-transition: the link is dropped, and
        // nothing may report the app inactive for a browser that never appeared.
        guard browser.presentingViewController != nil else {
            return
        }
        self.browser = browser
        reportAppState(isActive: false)
    }

    /// Through `@capacitor/app`'s own event: it is what the bundles in the field
    /// already listen to for foreground state.
    private func reportAppState(isActive: Bool) {
        bridge?.plugin(withName: "App")?.notifyListeners("appStateChange", data: ["isActive": isActive])
    }
}

// MARK: - SFSafariViewControllerDelegate

extension ExternalLinksPlugin: SFSafariViewControllerDelegate {
    public func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
        guard controller === browser else {
            return
        }
        browser = nil
        if UIApplication.shared.applicationState == .active {
            reportAppState(isActive: true)
        }
    }
}

/**
 * `window.open()` reaches the UI delegate's `createWebViewWith` without a
 * navigation-policy check, and Capacitor answers it with `UIApplication.open`
 * without asking plugins (a `target="_blank"` link is asked first, through
 * `decidePolicyFor` with no target frame). This sits in front of Capacitor's
 * delegate, gives new-window requests to `ExternalLinksPlugin` first and forwards
 * everything else unchanged. WKWebView holds its `uiDelegate` weakly, so the owner
 * must keep this alive.
 */
final class NewWindowRouter: NSObject, WKUIDelegate {
    private let capacitorUIDelegate: WKUIDelegate
    private let externalLinks: ExternalLinksPlugin

    init(forwardingTo capacitorUIDelegate: WKUIDelegate, externalLinks: ExternalLinksPlugin) {
        self.capacitorUIDelegate = capacitorUIDelegate
        self.externalLinks = externalLinks
    }

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, externalLinks.open(url) {
            return nil
        }
        return capacitorUIDelegate.webView?(webView, createWebViewWith: configuration, for: navigationAction, windowFeatures: windowFeatures)
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || capacitorUIDelegate.responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        capacitorUIDelegate.responds(to: aSelector) ? capacitorUIDelegate : super.forwardingTarget(for: aSelector)
    }
}
