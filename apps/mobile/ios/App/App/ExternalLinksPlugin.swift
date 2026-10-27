import Capacitor
import SafariServices
import UIKit
import WebKit

/// Opens external web pages in an in-app browser (SFSafariViewController) instead
/// of Safari. Capacitor asks every plugin before applying its own policy, whose
/// fallback for an off-origin top-level navigation is `UIApplication.open`, i.e.
/// Safari. Mirrored on Android by `ExternalLinksPlugin.java` (Custom Tabs).
///
/// Still left to the system: store pages, links an installed app claims (universal
/// links), and every non-web scheme (`mailto:`, `tel:`, the update screen's
/// `itms-apps:`), which SFSafariViewController cannot open anyway. Subframe loads
/// (embedded players) are never touched.
public class ExternalLinksPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalLinksPlugin"
    public let jsName = "ExternalLinks"
    public let pluginMethods: [CAPPluginMethod] = []

    /// In an in-app browser these render as a web page; Safari hands them to the App Store.
    private static let systemHosts: Set<String> = ["apps.apple.com", "itunes.apple.com", "play.google.com"]

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
              !url.absoluteString.hasPrefix(bridge.config.localURL.absoluteString)
        else {
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
        guard var top = bridge?.viewController else {
            return
        }
        while let presented = top.presentedViewController {
            top = presented
        }
        top.present(SFSafariViewController(url: url), animated: true)
    }
}

/// `window.open()` and `target="_blank"` reach the UI delegate's
/// `createWebViewWith`, which Capacitor answers with `UIApplication.open` without
/// asking plugins. This sits in front of Capacitor's delegate, gives those to
/// `ExternalLinksPlugin` first and forwards everything else unchanged. WKWebView
/// holds its `uiDelegate` weakly, so the owner must keep this alive.
final class NewWindowRouter: NSObject, WKUIDelegate {
    private let capacitor: WKUIDelegate
    private let externalLinks: ExternalLinksPlugin

    init(forwardingTo capacitor: WKUIDelegate, externalLinks: ExternalLinksPlugin) {
        self.capacitor = capacitor
        self.externalLinks = externalLinks
    }

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, externalLinks.open(url) {
            return nil
        }
        return capacitor.webView?(webView, createWebViewWith: configuration, for: navigationAction, windowFeatures: windowFeatures)
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || capacitor.responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        capacitor.responds(to: aSelector) ? capacitor : super.forwardingTarget(for: aSelector)
    }
}
