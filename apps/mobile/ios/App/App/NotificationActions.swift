import Capacitor
import Foundation
import UIKit
import UserNotifications

/**
 * Notification-resident actions, completed by the shell with no web view:
 * Approve / Reject on an approval request, inline Reply on a Mingo message.
 *
 * The server names the category (`aps.category` = APPROVAL_REQUEST | MINGO_REPLY,
 * contract-tested against ApplePushCategories.java) and flattens the ids the
 * action needs (`approvalRequestId`, `dialogId`, `type`) into the payload's
 * top-level keys. This registers the button sets under those identifiers, owns
 * the UNUserNotificationCenter delegate, consumes exactly its own three action
 * identifiers, and forwards everything else — a body tap, a tap on one of the
 * outcome notifications posted below — to the Firebase plugin's handler, so the
 * web view's tap → deep-link path keeps working unchanged.
 *
 * Owning the delegate is what `ios.handleApplicationNotifications: false` in
 * capacitor.config.ts is for: Capacitor's NotificationRouter then never claims
 * it. It is installed from `AppDelegate` — Apple requires the delegate before
 * launch finishes, and an action can launch the app in the background with its
 * response delivered during that launch — while the bridge attaches later from
 * `MainViewController.capacitorDidLoad`. A response the bridge is not yet there
 * to take is buffered, never dropped: the plugin has no replay path for one.
 *
 * The credential comes from `TokenLifecycle`: the pair the process holds,
 * refreshed first if stale, never a prompt — a background handler has nothing
 * to prompt with. With biometric login on, a cold-started process holds no pair
 * and cannot read one silently, so the actions are registered `.foreground`:
 * the app comes forward, the web view's launch read prompts, and the response
 * is handed on to it, which opens the item for the user to finish there. A
 * process that has already unlocked completes the action in the background
 * whether or not the store is gated — that is what the in-memory pair buys.
 */
final class NotificationActions: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationActions()

    /// The server's identifiers — `ApplePushCategories.java`.
    private static let approvalCategory = "APPROVAL_REQUEST"
    private static let replyCategory = "MINGO_REPLY"
    /// Ours. The web view never sees these: their responses end here.
    private static let approveAction = "of.approve"
    private static let rejectAction = "of.reject"
    private static let replyAction = "of.reply"
    /// Marks, in userInfo, the outcome notifications this class posts.
    private static let feedbackKey = "ofFeedback"

    /// iOS terminates a handler that has not called its completion after
    /// roughly 30s; call it by then whatever the request is doing, and let the
    /// background-task assertion carry the request the rest of the way.
    private static let completionDeadline: TimeInterval = 25
    private static let requestTimeout: TimeInterval = 10
    /// `SendMessageRequest.content` is `@Size(max = 10000)`.
    private static let maxReplyLength = 10_000
    private static let feedbackBodyLimit = 200

    private weak var bridge: CAPBridgeProtocol?
    private var buffered: [(response: UNNotificationResponse, completion: () -> Void)] = []
    private var installed = false

    /// The bearer goes in the header; see `URLSessionConfiguration.credentialFree`.
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.credentialFree
        config.timeoutIntervalForRequest = Self.requestTimeout
        config.timeoutIntervalForResource = Self.requestTimeout
        return URLSession(configuration: config)
    }()

    private override init() {
        super.init()
    }

    // MARK: - Wiring

    /// From `AppDelegate.didFinishLaunchingWithOptions`. Idempotent.
    func install() {
        guard !installed else { return }
        installed = true
        UNUserNotificationCenter.current().delegate = self
        registerCategories()
        // The button set depends on the biometric marker (see registerCategories);
        // `setNotificationCategories` replaces the whole set, so re-register on
        // every flip — enable, disable, and the logout that resets it.
        NotificationCenter.default.addObserver(
            forName: TokenStore.biometricGatingDidChange, object: nil, queue: .main
        ) { [weak self] _ in
            self?.registerCategories()
        }
    }

    /// From `MainViewController.capacitorDidLoad`: the plugin handler exists from
    /// here on, so anything buffered can be delivered.
    func attach(bridge: CAPBridgeProtocol) {
        self.bridge = bridge
        let pending = buffered
        buffered = []
        for item in pending {
            forward(item.response, completion: item.completion)
        }
    }

    /// Registered under the server's category identifiers. `.authenticationRequired`
    /// on every action: a privileged write from the lock screen should cost an
    /// unlock on the phone (on the Watch, wrist detection satisfies it and the
    /// iPhone stays locked — which the token item's `AfterFirstUnlock` class is
    /// chosen to allow). Reject is `.destructive`
    /// (denying a tool execution is the fail-safe direction, so it must not be
    /// harder than approving). `.foreground` only while the store is gated — see
    /// the type doc.
    private func registerCategories() {
        var options: UNNotificationActionOptions = [.authenticationRequired]
        if TokenStore.isBiometricGated {
            options.insert(.foreground)
        }
        let approve = UNNotificationAction(identifier: Self.approveAction, title: "Approve", options: options)
        let reject = UNNotificationAction(identifier: Self.rejectAction, title: "Reject", options: options.union(.destructive))
        let reply = UNTextInputNotificationAction(
            identifier: Self.replyAction,
            title: "Reply",
            options: options,
            textInputButtonTitle: "Send",
            textInputPlaceholder: "Reply to Mingo"
        )
        let approval = UNNotificationCategory(
            identifier: Self.approvalCategory, actions: [approve, reject], intentIdentifiers: [], options: []
        )
        let message = UNNotificationCategory(
            identifier: Self.replyCategory, actions: [reply], intentIdentifiers: [], options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([approval, message])
    }

    // MARK: - UNUserNotificationCenterDelegate (main thread)

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // An outcome the user is waiting on, while the app happens to be in front.
        if notification.request.content.userInfo[Self.feedbackKey] != nil {
            completionHandler([.banner, .list, .sound])
            return
        }
        // The plugin's answer is its configured presentationOptions (`[]` here —
        // foreground banners are suppressed) and, as a side effect, the
        // `notificationReceived` event the web view's in-app handling depends on.
        completionHandler(bridge?.notificationRouter.pushNotificationHandler?.willPresent(notification: notification) ?? [])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userText = (response as? UNTextInputNotificationResponse)?.userText
        guard let action = Self.action(identifier: response.actionIdentifier, userText: userText) else {
            forward(response, completion: completionHandler)
            return
        }
        perform(action, content: response.notification.request.content, response: response, completion: completionHandler)
    }

    /// Straight to the plugin's handler rather than through the router, which
    /// routes by trigger type and would drop a tap on one of our own (local)
    /// outcome notifications — whose userInfo carries the original ids precisely
    /// so that tap deep-links like the push it answers.
    private func forward(_ response: UNNotificationResponse, completion: @escaping () -> Void) {
        guard let bridge else {
            buffered.append((response, completion))
            return
        }
        guard let handler = bridge.notificationRouter.pushNotificationHandler else {
            ShellLog.notifications.error("no push handler to forward the response to — the Firebase plugin did not register one")
            completion()
            return
        }
        handler.didReceive(response: response)
        completion()
    }

    // MARK: - Actions

    private enum Action {
        case approve
        case reject
        case reply(String)

        var done: String {
            switch self {
            case .approve: return "Approved"
            case .reject: return "Rejected"
            case .reply: return "Reply sent"
            }
        }

        var verb: String {
            switch self {
            case .approve: return "approve"
            case .reject: return "reject"
            case .reply: return "send the reply"
            }
        }

        /// A failed reply carries the text back: responding to the notification
        /// cleared the inline field, so this is the only copy left.
        var echo: String {
            if case .reply(let text) = self { return " Your reply: \(text)" }
            return ""
        }

        var isReply: Bool {
            if case .reply = self { return true }
            return false
        }
    }

    private static func action(identifier: String, userText: String?) -> Action? {
        switch identifier {
        case approveAction:
            return .approve
        case rejectAction:
            return .reject
        case replyAction:
            let text = userText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return text.isEmpty ? nil : .reply(String(text.prefix(maxReplyLength)))
        default:
            return nil
        }
    }

    private func perform(_ action: Action, content: UNNotificationContent, response: UNNotificationResponse, completion: @escaping () -> Void) {
        // A `.foreground` action brings the app forward before this runs; a
        // background one leaves it in `.background`. Decides whether the response
        // is also handed to the web view afterwards, so the app that came forward
        // opens the item the user just acted on.
        let foregrounded = UIApplication.shared.applicationState != .background
        let finish = Once(completion)
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.completionDeadline) { finish.run() }
        // Refresh and request under one assertion: a suspended process loses the
        // request mid-flight, and the outcome notification with it. iOS
        // terminates a process that lets an assertion lapse, so its expiration
        // ends it as well — the outcome is lost either way.
        var assertion = UIBackgroundTaskIdentifier.invalid
        let end = {
            if assertion != .invalid {
                UIApplication.shared.endBackgroundTask(assertion)
                assertion = .invalid
            }
            finish.run()
        }
        assertion = UIApplication.shared.beginBackgroundTask(withName: "ai.openframe.mobile.notification-action") {
            ShellLog.notifications.error("\(action.verb): background time ran out")
            end()
        }
        ShellLog.notifications.notice("\(action.verb) requested (category: \(content.categoryIdentifier), foregrounded: \(foregrounded))")

        TokenLifecycle.shared.ensureFresh(trigger: "a notification action") { [weak self] result in
            DispatchQueue.main.async {
                guard let self else {
                    end()
                    return
                }
                self.act(action, content: content, session: result) {
                    // Always after the write: the web view's deep link lands on
                    // the item, and it should find the decision already made.
                    if foregrounded {
                        self.forward(response) {}
                    }
                    end()
                }
            }
        }
    }

    /// Runs on main. Every path posts exactly one outcome notification, except a
    /// gated store the web view will unlock in a moment — that path opens the
    /// app instead.
    private func act(_ action: Action, content: UNNotificationContent, session result: TokenLifecycle.RefreshResult, done: @escaping () -> Void) {
        let pair: TokenPair
        switch result {
        case .tokens(let current):
            pair = current
        case .sessionOver:
            signInFeedback(for: action, content: content)
            done()
            return
        case .failed(let code, let message):
            if code == TokenLifecycle.Code.biometricLocked {
                // Cold process, gated store. If the action brought the app forward
                // (registered `.foreground` for exactly this), the web view's launch
                // read prompts and the forwarded response opens the item. If the
                // marker flipped after delivery and the action ran in the
                // background, say so; the tap on this notification opens the app.
                if UIApplication.shared.applicationState == .background {
                    post(title: "Open OpenFrame to \(action.verb)",
                         body: "Unlock OpenFrame to \(action.verb).\(action.echo)",
                         original: content, retry: false)
                }
                done()
                return
            }
            ShellLog.notifications.error("could not \(action.verb): no usable session (\(code))")
            postFailure(action, reason: Self.sessionFailureReason(code: code, message: message), content: content)
            done()
            return
        }
        guard let access = pair.access, Self.stillLive(access) else {
            signInFeedback(for: action, content: content)
            done()
            return
        }
        // The session, not the notification, is the authority. A push that names
        // its recipient must be answered by that account — a banner can outlive a
        // sign-out and a different sign-in. A token whose `userId` cannot be
        // read does not get the benefit of the doubt.
        if let recipient = content.userInfo["recipientUserId"] as? String, !recipient.isEmpty,
           TokenLifecycle.jwtClaim(access, "userId") != recipient {
            post(title: content.title,
                 body: "This notification belongs to a different account.\(action.echo)",
                 original: content, retry: false)
            done()
            return
        }
        guard let base = TokenLifecycle.shared.learnedTenantHost() else {
            post(title: "Open OpenFrame to \(action.verb)",
                 body: "This install has not learned its gateway yet — open OpenFrame once, then try again.\(action.echo)",
                 original: content, retry: true)
            done()
            return
        }
        guard let request = Self.request(for: action, content: content, base: base, bearer: access) else {
            ShellLog.notifications.notice("the notification carries no id the action needs")
            post(title: content.title,
                 body: "This notification carries nothing to \(action.verb).\(action.echo)",
                 original: content, retry: false)
            done()
            return
        }

        session.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else {
                    done()
                    return
                }
                self.report(action, content: content, data: data, response: response as? HTTPURLResponse, error: error)
                done()
            }
        }.resume()
    }

    // MARK: - Requests

    private static func request(for action: Action, content: UNNotificationContent, base: URL, bearer: String) -> URLRequest? {
        let info = content.userInfo
        let path: String
        let body: [String: Any]
        switch action {
        case .approve, .reject:
            guard let id = validId(info["approvalRequestId"]) else { return nil }
            path = "/chat/api/v1/approval-requests/\(id)/approve"
            if case .approve = action { body = ["approve": true] } else { body = ["approve": false] }
        case .reply(let text):
            guard let id = validId(info["dialogId"]) else { return nil }
            path = "/chat/api/v1/messages"
            // Static, not inferred: both specs behind MINGO_REPLY sit behind the
            // same `chatType == ADMIN_AI_CHAT` guard server-side.
            body = ["dialogId": id, "content": text, "chatType": "ADMIN_AI_CHAT"]
        }
        // Built on the learned origin, never from payload text: the id is an
        // opaque path segment of a fixed base.
        guard var components = URLComponents(url: base, resolvingAgainstBaseURL: false) else { return nil }
        components.path = path
        guard let url = components.url,
              let payload = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = payload
        return request
    }

    /// An id goes into a URL path: nothing but an identifier may.
    private static func validId(_ value: Any?) -> String? {
        guard let id = value as? String,
              (1...128).contains(id.count),
              id.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") }) else {
            return nil
        }
        return id
    }

    // MARK: - Outcomes

    private func report(_ action: Action, content: UNNotificationContent, data: Data?, response: HTTPURLResponse?, error: Error?) {
        if let error {
            ShellLog.notifications.error("could not \(action.verb): \(error.localizedDescription)")
            postFailure(action, reason: "OpenFrame could not be reached", content: content)
            return
        }
        guard let response else {
            postFailure(action, reason: "no response", content: content)
            return
        }
        let status = response.statusCode
        let gateway = Self.gatewayError(data)
        ShellLog.notifications.notice("\(action.verb): HTTP \(status) \(gateway.code ?? "")")
        switch status {
        case 200..<300:
            let body: String
            if case .reply(let text) = action { body = text } else { body = content.body.isEmpty ? content.title : content.body }
            post(title: action.done, body: body, original: content, retry: false)
        case 401:
            signInFeedback(for: action, content: content)
        case 404:
            post(title: "No longer available",
                 body: "This \(action.isReply ? "conversation" : "request") no longer exists.",
                 original: content, retry: false)
        case 409 where gateway.code == "DIALOG_LOCKED":
            post(title: "Mingo is busy",
                 body: "Mingo is still working on this conversation. Try again in a moment.\(action.echo)",
                 original: content, retry: true)
        case 409 where !action.isReply:
            // `ILLEGAL_STATE` covers already-processed, a non-writable dialog and
            // direct mode alike; the gateway's own message names which. Not a
            // failed press: the decision it asked for has been made.
            post(title: "Already handled",
                 body: gateway.message ?? "This request was already resolved or is no longer open.",
                 original: content, retry: false)
        default:
            postFailure(action, reason: gateway.message ?? "HTTP \(status)", content: content)
        }
    }

    /// A press that did not go through, with the button still there to retry.
    private func postFailure(_ action: Action, reason: String, content: UNNotificationContent) {
        post(title: content.title,
             body: "Could not \(action.verb) — \(reason).\(action.echo)",
             original: content, retry: true)
    }

    private func signInFeedback(for action: Action, content: UNNotificationContent) {
        post(title: "Sign in to OpenFrame",
             body: "Your session has ended. Open OpenFrame and sign in to \(action.verb).\(action.echo)",
             original: content, retry: false)
    }

    private static func sessionFailureReason(code: String, message: String) -> String {
        switch code {
        case TokenLifecycle.Code.unreached: return "OpenFrame could not be reached"
        case TokenLifecycle.Code.deviceLocked: return "the device is locked"
        case TokenLifecycle.Code.noHost: return "this install has not learned its gateway yet"
        case TokenLifecycle.Code.unknown, TokenLifecycle.Code.held: return "the session could not be refreshed just now"
        default: return message
        }
    }

    /// Never a failure the request did not cause: an `exp` that cannot be read
    /// counts as live, and the gateway's 401 owns it.
    private static func stillLive(_ access: String) -> Bool {
        guard let exp = TokenLifecycle.jwtExpiry(access) else { return true }
        return exp > Date()
    }

    /// The gateway's `ErrorResponse`: a machine `code` and a human `message`.
    private static func gatewayError(_ data: Data?) -> (code: String?, message: String?) {
        guard let data, !data.isEmpty,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return (nil, nil)
        }
        let message = (object["message"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (object["code"] as? String, message.flatMap { $0.isEmpty ? nil : String($0.prefix(feedbackBodyLimit)) })
    }

    /// The only place an outcome reaches the user: there is no window to report
    /// into. The original userInfo rides along so a tap on this opens the same
    /// item the push would have; `retry` keeps the original category, so a
    /// failed decision is still there to make.
    private func post(title: String, body: String, original: UNNotificationContent, retry: Bool) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = String(body.prefix(Self.feedbackBodyLimit * 2))
        content.sound = .default
        content.threadIdentifier = original.threadIdentifier
        var info = original.userInfo
        info[Self.feedbackKey] = true
        content.userInfo = info
        if retry {
            content.categoryIdentifier = original.categoryIdentifier
        }
        let request = UNNotificationRequest(identifier: "of.feedback.\(UUID().uuidString)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                ShellLog.notifications.error("outcome notification rejected: \(error.localizedDescription)")
            }
        }
    }

    /// A completion that may be reached from the deadline, the request, and the
    /// early exits, and must run exactly once.
    private final class Once {
        private var block: (() -> Void)?
        init(_ block: @escaping () -> Void) { self.block = block }
        func run() {
            let pending = block
            block = nil
            pending?()
        }
    }
}
