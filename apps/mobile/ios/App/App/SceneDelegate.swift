import Capacitor
import UIKit

/// The app's one window scene (`UIApplicationSceneManifest` in Info.plist).
/// Built against the iOS 27 SDK, an app without a scene delegate is killed by
/// UIKit at launch (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`),
/// which is how 1.0.2 (2026102701) crashed on every iOS 27 device. The window
/// and `MainViewController` still come from Main.storyboard, now through the
/// scene configuration's `UISceneStoryboardFile`.
///
/// Under the scene lifecycle UIKit delivers URL opens and user activities here
/// instead of to AppDelegate, so they are handed to Capacitor's proxy exactly as
/// AppDelegate used to. Login does not depend on them: ASWebAuthenticationSession
/// receives its callback inside the session.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // A cold launch carries its URL / activity in the connection options; the
        // proxy keeps it as `lastURL` until the bridge is up to read it.
        if let context = connectionOptions.urlContexts.first {
            open(context)
        }
        if let activity = connectionOptions.userActivities.first {
            self.scene(scene, continue: activity)
        }
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
