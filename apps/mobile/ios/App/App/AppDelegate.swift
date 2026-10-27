import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    // The window, URL opens and user activities belong to SceneDelegate: under the
    // scene lifecycle UIKit never calls their AppDelegate counterparts.
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Notification permission is requested by the web layer after login
        // (openframe-frontend src/lib/native-push.ts) — not at launch.
        // Note for `npm run push:demo`: banners display only after that in-app
        // permission grant.
        //
        // The notification delegate, here rather than with the bridge: Apple wants
        // it before launch finishes, and an action button can launch the app in the
        // background with its response delivered during that launch. Capacitor's
        // router stays out of the way (`ios.handleApplicationNotifications: false`).
        NotificationActions.shared.install()
        return true
    }

    // @capacitor-firebase/messaging receives APNs callbacks via these
    // NotificationCenter posts — without them FCM token registration hangs with
    // "event capacitorDidRegisterForRemoteNotifications not called". Firebase is
    // auto-configured by the plugin's load() (reads GoogleService-Info.plist).
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    /// `FcmPushSender`'s payload keys. A retraction names its target in `notificationId`;
    /// every push also carries the rolling `retractedIds` list (a JSON array in a string)
    /// because FCM confirms nothing.
    private static let notificationIdKey = "notificationId"
    private static let eventKey = "event"
    private static let retractedIdsKey = "retractedIds"
    private static let retractedEvent = "NOTIFICATION_RETRACTED"

    // Retraction is done here, not by the web view: the backend's retraction is a
    // silent push, which wakes a suspended or system-terminated app (never a
    // force-quit one) for a few seconds — too little to boot the web app past token
    // hydration, and a gated store stops it at the prompt.
    //
    // The completion must be called exactly once, from here. With Firebase's
    // app-delegate swizzling on (the default), `completionHandler` is a
    // GULAppDelegateSwizzler wrapper that leaves a dispatch group; FIRMessaging
    // calls its own copy, and the system handler fires only once both have. The
    // plugin receives this one as the post's `object` and never calls it (8.3.0) —
    // if a later version does, drop the call here, or the group over-leaves and crashes.
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
        let retracted = Self.retractedIds(userInfo)
        guard !retracted.isEmpty else {
            completionHandler(.noData)
            return
        }
        let center = UNUserNotificationCenter.current()
        center.getDeliveredNotifications { delivered in
            // Matched on OUR id in userInfo, not the request identifier: that catches
            // the push itself and the outcome notifications NotificationActions posts
            // for it (`of.feedback.*`, carrying the original userInfo).
            let doomed = delivered
                .filter { ($0.request.content.userInfo[Self.notificationIdKey] as? String).map(retracted.contains) ?? false }
                .map(\.request.identifier)
            if !doomed.isEmpty {
                center.removeDeliveredNotifications(withIdentifiers: doomed)
                ShellLog.notifications.notice("retracted \(doomed.count) delivered notification(s)")
            }
            DispatchQueue.main.async {
                completionHandler(doomed.isEmpty ? .noData : .newData)
            }
        }
    }

    /// Only a retraction's own `notificationId` is dead — on any other push it names
    /// the push itself.
    private static func retractedIds(_ userInfo: [AnyHashable: Any]) -> Set<String> {
        var ids = Set<String>()
        if userInfo[eventKey] as? String == retractedEvent, let id = userInfo[notificationIdKey] as? String, !id.isEmpty {
            ids.insert(id)
        }
        guard let list = userInfo[retractedIdsKey] as? String, !list.isEmpty else {
            return ids
        }
        if let parsed = try? JSONSerialization.jsonObject(with: Data(list.utf8)) as? [Any] {
            ids.formUnion(parsed.compactMap { $0 as? String }.filter { !$0.isEmpty })
        } else {
            ShellLog.notifications.error("retractedIds is not a JSON array")
        }
        return ids
    }

}
