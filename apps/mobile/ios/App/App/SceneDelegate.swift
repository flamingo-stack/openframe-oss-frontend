import Capacitor
import UIKit

/**
 * The app's one window scene (`UIApplicationSceneManifest` in Info.plist; the window
 * and `MainViewController` come from Main.storyboard, through `UISceneStoryboardFile`).
 * Mandatory: an iOS 27 SDK build without it is killed by UIKit at launch
 * (apps/mobile CLAUDE.md, "iOS 27 kills an app without the UIScene lifecycle").
 *
 * Under scenes UIKit delivers URL opens and user activities here instead of to
 * AppDelegate, so they go to Capacitor's `ApplicationDelegateProxy`, the same
 * forwarding Capacitor's template AppDelegate does.
 * Login does not depend on them: ASWebAuthenticationSession receives its callback
 * inside the session.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // A cold launch carries its URLs and activities in the connection options; the
        // proxy keeps the last URL as `lastURL` until the bridge is up to read it.
        self.scene(scene, openURLContexts: connectionOptions.urlContexts)
        connectionOptions.userActivities.forEach { self.scene(scene, continue: $0) }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        URLContexts.forEach(open)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity) { _ in }
    }

    private func open(_ context: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
        if let source = context.options.sourceApplication {
            options[.sourceApplication] = source
        }
        if let annotation = context.options.annotation {
            options[.annotation] = annotation
        }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
    }
}
