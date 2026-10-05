import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

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

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
