import AuthenticationServices
import Capacitor
import Foundation
import LocalAuthentication
import Security
import UIKit

/**
 * Local Capacitor plugin backing the frontend's `NativeAuth` bridge
 * (openframe-frontend: src/lib/native-shell.ts).
 *
 * - start: OAuth login in ASWebAuthenticationSession (system browser). An
 *   embedded WKWebView is not an option: Google (and other third-party IdPs)
 *   refuse to render their authorize page in one — 403 disallowed_useragent.
 *   The session completes on a custom-scheme callback, not Callback.https:
 *   claimed-https needs an Associated Domains entitlement + AASA the infra
 *   doesn't have (and the entitlement is unavailable on the free team). The
 *   gateway redirects the devTicket straight to the scheme (authMobile=true
 *   logins). The desktop Tauri shell now ends its login on the same scheme,
 *   cancelling the navigation to it inside its own window.
 * - exchangeTicket: dev-ticket -> tokens over native HTTP, so the WebView
 *   never fights CORS for the Access-Token/Refresh-Token response headers.
 * - get/set/clearTokens: Keychain storage, AfterFirstUnlockThisDeviceOnly
 *   (device-bound: excluded from iCloud Keychain sync and backups; readable on
 *   a locked phone so a Watch-initiated notification action can act), fronted by
 *   the in-memory pair `TokenLifecycle` holds for the life of the process.
 * - refreshTokens: shell-owned refresh. Its presence is what makes the web
 *   view's token-refresh-manager delegate here and stop calling /oauth/refresh
 *   itself — rotating refresh tokens tolerate exactly one refresher. The
 *   mechanics live in TokenLifecycle.swift; what stays here is the mapping of
 *   an outcome onto the bridge contract: tokens, an empty set for a session
 *   that is over, a rejection for everything that leaves the session intact.
 * - setTenantHost: the login-learned tenant origin, persisted shell-side so the
 *   refresher has a gateway without depending on web-view storage.
 */
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exchangeTicket", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isBiometricAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isBiometricLoginEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enableBiometricLogin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disableBiometricLogin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSafeAreaInsets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exchangeApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refreshTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTenantHost", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        // The lifecycle pushes token changes to the web view through this
        // plugin (`notifyListeners`), and its foreground observers start here.
        TokenLifecycle.shared.attach(plugin: self)
    }

    // Not auth-related, but this is the shell's only local plugin: WKWebView
    // reports env(safe-area-inset-*) as 0 until it has laid out, so the frontend
    // asks the native layer for the real insets and sets CSS variables from them.
    //
    // Read the WINDOW, not the web view. WebKit strands the web view's own
    // `safeAreaInsets` at its fullscreen container's values after an element
    // fullscreen round trip (bottom 34 -> 42pt on an iPhone 17 Pro) and no public
    // UIKit call recomputes them — not `layoutIfNeeded`, not a frame cycle, not
    // `additionalSafeAreaInsets`, not remove/re-add. The window's stay correct in
    // every state, including DURING fullscreen, where the web view reports zeros
    // because WebKit has reparented it into its own status-bar-less window.
    // The two are the same rectangle here: the status bar overlays the WebView.
    @objc func getSafeAreaInsets(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let view = self.bridge?.viewController?.view
            let insets = view?.window?.safeAreaInsets ?? view?.safeAreaInsets ?? .zero
            call.resolve([
                "top": insets.top,
                "bottom": insets.bottom,
                "left": insets.left,
                "right": insets.right
            ])
        }
    }

    // MARK: - Login

    private static let callbackScheme = "com.openframe.app"

    /// Session for the token-exchange calls — see `URLSessionConfiguration.credentialFree`.
    private static let exchangeSession = URLSession(configuration: .credentialFree)

    /**
     * Destination guard for the JS-supplied URLs on `start`, `exchangeTicket`, `exchangeApple`.
     *
     * These take a URL from the web layer, which makes them an arbitrary-request primitive for
     * anything executing in the WebView — and the WebView renders remote Help Center and chat
     * content. This enforces https, which blocks a downgrade to http and every non-web scheme.
     *
     * It deliberately does NOT pin the host: the shell has no configured host to pin to (the
     * shared host is baked into the web bundle, not Info.plist), and inventing one here would
     * break tenant gateways and self-hosted deployments. Host pinning wants a build setting
     * alongside OPENFRAME_URL_SCHEME and is tracked separately.
     */
    private static func isAllowedAuthEndpoint(_ url: URL) -> Bool {
        return url.scheme?.lowercased() == "https" && (url.host?.isEmpty == false)
    }

    /**
     * The `url` argument of a JS-facing method, parsed and vetted, or nil having already rejected
     * the call. Every entry point that takes a URL from the web layer goes through here so the
     * guard cannot be forgotten on the next one; `refusal` names what that method would have done
     * with it.
     */
    private static func validatedAuthURL(from call: CAPPluginCall, refusal: String, allowedPaths: [String]? = nil) -> URL? {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return nil
        }
        guard isAllowedAuthEndpoint(url) else {
            call.reject(refusal, "URL_NOT_ALLOWED")
            return nil
        }
        // The host cannot be pinned (tenant gateways and self-hosted deployments vary), but the
        // PATH can: these methods exist to call two known endpoints. Pinning it costs nothing and
        // takes away the "fetch any https URL" shape the bridge would otherwise hand the WebView.
        // Collapsed before comparing: a configured host carrying a trailing slash yields
        // `//oauth/...`, which would otherwise fail the pin and take every token exchange with it.
        let path = url.path.replacingOccurrences(of: "/+", with: "/", options: .regularExpression)
        if let allowedPaths, !allowedPaths.contains(path) {
            call.reject(refusal, "URL_NOT_ALLOWED")
            return nil
        }
        return url
    }

    private var authSession: ASWebAuthenticationSession?
    private var appleCall: CAPPluginCall?
    private var appleController: ASAuthorizationController?

    @objc func start(_ call: CAPPluginCall) {
        guard let url = Self.validatedAuthURL(from: call, refusal: "Refusing to open a non-https sign-in URL") else { return }
        let scheme = call.getString("callbackScheme") ?? Self.callbackScheme

        DispatchQueue.main.async {
            guard self.authSession == nil else {
                call.reject("A sign-in session is already open", "ALREADY_PRESENTING")
                return
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.authSession = nil
                if let callbackURL {
                    call.resolve(["callbackUrl": callbackURL.absoluteString])
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("USER_CANCELED", "USER_CANCELED")
                } else {
                    call.reject("Login failed: \(error?.localizedDescription ?? "unknown error")")
                }
            }
            session.presentationContextProvider = self
            // Default (non-ephemeral) keeps IdP cookies for SSO continuity;
            // the tradeoff is that logout cannot clear the system browser session.
            self.authSession = session
            if !session.start() {
                self.authSession = nil
                call.reject("Could not start the sign-in session")
            }
        }
    }

    // MARK: - Dev-ticket exchange

    @objc func exchangeTicket(_ call: CAPPluginCall) {
        guard let url = Self.validatedAuthURL(
            from: call,
            refusal: "Refusing to send the ticket anywhere but the dev-exchange endpoint over https",
            allowedPaths: ["/oauth/dev-exchange"]
        ) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        Self.exchangeSession.dataTask(with: request) { _, response, error in
            if let error {
                call.reject("Ticket exchange failed: \(error.localizedDescription)")
                return
            }
            guard let http = response as? HTTPURLResponse else {
                call.reject("Ticket exchange failed: no HTTP response")
                return
            }
            guard (200..<300).contains(http.statusCode) else {
                call.reject("Ticket exchange failed with status \(http.statusCode)")
                return
            }
            call.resolve(Self.tokensResult(from: TokenPair(headersOf: http)))
        }.resume()
    }

    // MARK: - Native Sign in with Apple

    /**
     * The native Sign in with Apple sheet (ASAuthorizationController). `nonce`
     * arrives pre-hashed (SHA-256 hex of the raw nonce the JS side keeps);
     * Apple embeds it into the identity token's `nonce` claim, and the backend
     * re-hashes the raw nonce to bind the token to this attempt.
     */
    @objc func signInWithApple(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("Missing 'nonce'")
            return
        }
        DispatchQueue.main.async {
            guard self.appleCall == nil else {
                call.reject("A sign-in session is already open", "ALREADY_PRESENTING")
                return
            }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleCall = call
            self.appleController = controller
            controller.performRequests()
        }
    }

    /**
     * POSTs the Apple credential to the gateway BFF's native-exchange endpoint
     * over native HTTP — same rationale as exchangeTicket: the WebView never
     * fights CORS for the Access-Token/Refresh-Token response headers.
     */
    @objc func exchangeApple(_ call: CAPPluginCall) {
        guard let url = Self.validatedAuthURL(
            from: call,
            refusal: "Refusing to POST anywhere but the Apple native-auth endpoints over https",
            allowedPaths: ["/oauth/apple/native-exchange", "/oauth/apple/native-register"]
        ) else { return }
        guard let body = call.getObject("body"),
              let payload = try? JSONSerialization.data(withJSONObject: body) else {
            call.reject("Missing or invalid 'body'")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = payload

        Self.exchangeSession.dataTask(with: request) { data, response, error in
            // Only a TRANSPORT failure rejects. Every HTTP status resolves, carrying the code and
            // the body, because the interesting outcomes here are not errors: the gateway answers
            // 409 {"error":"registration_required"} for a verified Apple identity that simply has
            // no account yet, and that is a branch into signup, not a failed sign-in. Collapsing
            // non-2xx into a rejection is what made the app claim "no account for this Apple ID"
            // for seven distinct backend failures.
            if let error {
                call.reject("Apple exchange failed: \(error.localizedDescription)")
                return
            }
            guard let http = response as? HTTPURLResponse else {
                call.reject("Apple exchange failed: no HTTP response")
                return
            }
            var result = Self.tokensResult(from: TokenPair(headersOf: http))
            result["status"] = http.statusCode
            // The body is relayed ONLY for a failure. The caller reads it for one
            // thing — the machine code in {"error": "..."} that distinguishes `registration_required`
            // from a real failure — and a success is a 204 whose tokens arrive in the headers above.
            //
            // Narrow because this is the one place the bridge hands a response body back to the web
            // layer, and the destination guard only enforces https. Without the status limit the
            // method reads as "fetch any https URL and give me the body", which is a capability the
            // WebView should not have. Host pinning is the real fix and wants a build setting
            // alongside OPENFRAME_URL_SCHEME; until then this keeps the surface to error payloads.
            //
            // Deliberately NOT also gated on a JSON Content-Type: the whole signup branch depends on
            // reading the 409's `registration_required`, so a gateway that ever answers without that
            // header would break the flow silently, and the header buys little on top of the status
            // and size limits.
            if !(200..<300).contains(http.statusCode),
               let data, !data.isEmpty, data.count <= 8192,
               let text = String(data: data, encoding: .utf8) {
                result["body"] = text
            }
            call.resolve(result)
        }.resume()
    }

    // MARK: - Keychain token storage
    //
    // The raw Keychain calls live in `TokenStore`; the in-memory pair and the
    // refresher in `TokenLifecycle`. What stays here is policy: when a read may
    // prompt, and what a failure means to the session.

    @objc func getTokens(_ call: CAPPluginCall) {
        let lifecycle = TokenLifecycle.shared
        // The process already holds the pair — from the launch read, a login or
        // a rotation. Answer from it: with biometric login on, this is what
        // keeps a launch to ONE prompt however many times the web view
        // re-hydrates (the full navigation after login, an unlock-gate retry).
        if let pair = lifecycle.cachedPair() {
            call.resolve(Self.tokensResult(from: pair))
            return
        }
        // Both tokens live in one item. With biometric login on it carries a
        // .biometryCurrentSet access-control, so the single SecItemCopyMatching
        // drives one Face ID / Touch ID prompt. Off the marker path there's no
        // prompt and a missing item just yields an empty result.
        if TokenStore.isBiometricGated {
            // The gated read must run off the main thread: the biometric prompt
            // SecItemCopyMatching drives is synchronous and would block the UI.
            let epoch = lifecycle.custodyEpoch()
            DispatchQueue.global(qos: .userInitiated).async {
                let (blob, status) = TokenStore.readStatus(account: TokenStore.tokensAccount)
                if let code = Self.biometricRejectCode(for: status) {
                    call.reject(code, code)
                    return
                }
                call.resolve(Self.tokensResult(from: lifecycle.adopt(promptedRead: TokenStore.decode(blob), under: epoch)))
            }
            return
        }
        switch lifecycle.readSilently() {
        case .pair(let pair):
            call.resolve(Self.tokensResult(from: pair))
        case .absent:
            call.resolve([:])
        case .unreadable:
            // A locked device: the item exists and cannot be read until it is
            // unlocked. Rejecting (rather than resolving empty) is what keeps the
            // web view from reading "signed out" into a background launch — the
            // frontend treats DEVICE_LOCKED as a retryable lock, and its
            // force-logout leaves the Keychain alone while one is up.
            call.reject("The stored tokens cannot be read while the device is locked", TokenLifecycle.Code.deviceLocked)
        }
    }

    @objc func setTokens(_ call: CAPPluginCall) {
        // A login result. The lifecycle merges it over what it holds, writes the
        // full pair as ONE item (gated per the marker; no gated read-modify-write,
        // so the write stays silent), and treats it as a custody change so a
        // rotation still in flight for the previous pair cannot land on top.
        let incoming = TokenPair(
            access: call.getString(TokenPair.accessKey),
            refresh: call.getString(TokenPair.refreshKey)
        )
        let status = TokenLifecycle.shared.store(incoming)
        TokenStore.deleteLegacyItems()
        guard status == errSecSuccess else {
            call.reject("Keychain write failed: OSStatus \(status)")
            return
        }
        call.resolve()
    }

    @objc func clearTokens(_ call: CAPPluginCall) {
        // Logout resets to a clean ungated state: the next login writes fresh
        // ungated tokens and the user re-opts into biometric. Runs on
        // TokenStore.queue (inside endSession), so a logout landing inside the
        // enable completion's read→gated-rewrite window cannot be resurrected by
        // it — the enable block re-creating the just-deleted item, marker re-set.
        TokenLifecycle.shared.endSession()
        TokenStore.deleteLegacyItems()
        call.resolve()
    }

    // MARK: - Shell-owned refresh

    /**
     * The web view's delegated refresh. `rejectedAccessToken` is the bearer the
     * gateway refused; when the stored one already differs, a rotation beat this
     * call and is answered from, instead of spending another refresh token.
     *
     * Reject — never resolve empty — for anything that leaves the session
     * intact. The web view maps an empty resolve to "session over", which runs
     * `clearStoredTokens` and with it this plugin's `clearTokens`, turning
     * biometric login off on top of signing the user out. A locked device or an
     * unsettled network must not do that. Only a gateway rejection, or no refresh
     * token to present at all, resolves empty.
     */
    @objc func refreshTokens(_ call: CAPPluginCall) {
        TokenLifecycle.shared.refresh(rejectedAccessToken: call.getString("rejectedAccessToken")) { result in
            switch result {
            case .tokens(let pair):
                call.resolve(Self.tokensResult(from: pair))
            case .sessionOver:
                call.resolve([:])
            case .failed(let code, let message):
                call.reject(message, code)
            }
        }
    }

    /**
     * The hosts the web view knows: `origin`, the tenant gateway learned at
     * login (where a notification action's chat calls go), and `sharedOrigin`,
     * the shared auth host the web view refreshes against — the refresher's
     * base when the build carries no plist host. Never the other way round: see
     * `TokenLifecycle.setSharedHost` for why the tenant host must not refresh.
     */
    @objc func setTenantHost(_ call: CAPPluginCall) {
        guard let origin = call.getString("origin"), TokenLifecycle.shared.setTenantHost(origin) else {
            call.reject("Refusing a tenant host that is not an https origin", "URL_NOT_ALLOWED")
            return
        }
        if let shared = call.getString("sharedOrigin"), !shared.isEmpty, !TokenLifecycle.shared.setSharedHost(shared) {
            call.reject("Refusing a shared host that is not an https origin", "URL_NOT_ALLOWED")
            return
        }
        call.resolve()
    }

    // MARK: - Biometric-gated storage

    /// Reports whether the device can evaluate biometrics right now. Never
    /// prompts (canEvaluatePolicy is a capability check, not an evaluation).
    @objc func isBiometricAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        call.resolve([
            "available": available,
            "biometryType": Self.biometryTypeString(context.biometryType)
        ])
    }

    /// Reads the non-gated marker only — never touches the gated token items,
    /// so this never prompts.
    @objc func isBiometricLoginEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": TokenStore.isBiometricGated])
    }

    /// Verifies the user with the OS biometric prompt, then re-stores the
    /// currently-present (ungated) tokens biometric-gated and flips the marker.
    /// Adding a .biometryCurrentSet item never prompts, so without an explicit
    /// evaluatePolicy the enable would be silent and the user would meet both
    /// the one-time Face ID permission alert AND the first scan at the next
    /// cold start — the prompt belongs at opt-in, and a device that cannot
    /// actually evaluate must fail here, not wedge the next launch.
    /// Rejects BIOMETRIC_UNAVAILABLE / NO_TOKENS / BIOMETRIC_CANCELED.
    @objc func enableBiometricLogin(_ call: CAPPluginCall) {
        let context = LAContext()
        // Biometrics-only policy — there is no passcode path here, so hide the
        // fallback button that would appear after a failed attempt.
        context.localizedFallbackTitle = ""
        var laError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &laError) else {
            call.reject("BIOMETRIC_UNAVAILABLE", "BIOMETRIC_UNAVAILABLE")
            return
        }
        // Fail fast before prompting.
        guard TokenLifecycle.shared.cachedPair() != nil else {
            call.reject("NO_TOKENS", "NO_TOKENS")
            return
        }
        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Enable biometric login"
        ) { success, error in
            guard success else {
                let code = Self.laRejectCode(for: error)
                call.reject(code, code)
                return
            }
            // The pair the process holds AFTER the prompt, gated on the store
            // queue: a rotation may have landed while the sheet was up, and
            // gating a pre-prompt snapshot would wind the session back.
            switch TokenLifecycle.shared.gate() {
            case errSecSuccess:
                call.resolve()
            case errSecItemNotFound:
                call.reject("NO_TOKENS", "NO_TOKENS")
            case let status:
                call.reject("Keychain write failed: OSStatus \(status)")
            }
        }
    }

    /// Reads the gated tokens (this prompts) and re-stores them ungated, then
    /// clears the marker. Rejects BIOMETRIC_CANCELED if the user dismisses the
    /// prompt. Runs the gated read off the main thread.
    @objc func disableBiometricLogin(_ call: CAPPluginCall) {
        guard TokenStore.isBiometricGated else {
            // Already ungated — nothing to do.
            call.resolve()
            return
        }
        let epoch = TokenLifecycle.shared.custodyEpoch()
        DispatchQueue.global(qos: .userInitiated).async {
            let (blob, status) = TokenStore.readStatus(account: TokenStore.tokensAccount)
            if let code = Self.biometricRejectCode(for: status) {
                if code == "BIOMETRIC_INVALIDATED" {
                    // Enrollment change dropped the item — the tokens are gone
                    // either way, so return to a clean ungated state instead of
                    // leaving the marker pointing at nothing; the frontend
                    // reacts to INVALIDATED with a forced re-login.
                    TokenLifecycle.shared.endSession()
                }
                call.reject(code, code)
                return
            }
            // The prompt was the consent; the pair the process holds NOW is what
            // gets re-stored, the blob read before the sheet went up only a
            // fallback under an unchanged epoch (see `TokenLifecycle.ungate`).
            let writeStatus = TokenLifecycle.shared.ungate(promptedRead: TokenStore.decode(blob), under: epoch)
            guard writeStatus == errSecSuccess else {
                call.reject("Keychain write failed: OSStatus \(writeStatus)")
                return
            }
            call.resolve()
        }
    }

    private static func biometryTypeString(_ type: LABiometryType) -> String {
        switch type {
        case .faceID: return "faceId"
        case .touchID: return "touchId"
        default: return "none"
        }
    }

    /// Maps a gated-read OSStatus to a JS reject code, or nil on success. The
    /// marker being on asserts the tokens exist, so on the gated path an
    /// item-not-found is not an empty session — it's the .biometryCurrentSet
    /// item having been invalidated (and dropped) by an enrollment change.
    private static func biometricRejectCode(for status: OSStatus) -> String? {
        switch status {
        case errSecSuccess:
            return nil
        case errSecUserCanceled:
            return "BIOMETRIC_CANCELED"
        case errSecItemNotFound:
            // Enrollment change with .biometryCurrentSet drops the item.
            return "BIOMETRIC_INVALIDATED"
        case errSecAuthFailed:
            // Ambiguous: a terminal no-match, a biometry lockout, and (on some
            // iOS versions) an enrollment-change invalidation all surface as
            // auth-failed. Consumers of INVALIDATED destroy state, so report it
            // only when the item is provably gone; a still-present item is a
            // retryable failure.
            return TokenStore.existsWithoutPrompting(account: TokenStore.tokensAccount) ? "BIOMETRIC_CANCELED" : "BIOMETRIC_INVALIDATED"
        default:
            return "BIOMETRIC_CANCELED"
        }
    }

    /// Maps an LAContext evaluatePolicy failure to a JS reject code. Cancels
    /// (user / system / app / fallback button) are retryable; everything else
    /// means biometrics cannot be evaluated on this device right now.
    private static func laRejectCode(for error: Error?) -> String {
        switch (error as? LAError)?.code {
        case .userCancel, .systemCancel, .appCancel, .userFallback:
            return "BIOMETRIC_CANCELED"
        case .authenticationFailed:
            // Terminal no-match (the user exhausted attempts) — retryable.
            return "BIOMETRIC_CANCELED"
        default:
            return "BIOMETRIC_UNAVAILABLE"
        }
    }

    /// The pair as a JS result; absent halves are omitted.
    private static func tokensResult(from pair: TokenPair) -> JSObject {
        pair.fields.mapValues { $0 as JSValue }
    }
}

extension NativeAuthPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        let call = appleCall
        appleCall = nil
        appleController = nil
        guard let call else { return }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8),
              let codeData = credential.authorizationCode,
              let authorizationCode = String(data: codeData, encoding: .utf8) else {
            call.reject("Apple sign-in returned no usable credential")
            return
        }
        var result = JSObject()
        result["identityToken"] = identityToken
        result["authorizationCode"] = authorizationCode
        // Present only on the very first authorization for this Apple ID.
        if let firstName = credential.fullName?.givenName { result["firstName"] = firstName }
        if let lastName = credential.fullName?.familyName { result["lastName"] = lastName }
        if let email = credential.email { result["email"] = email }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithError error: Error) {
        let call = appleCall
        appleCall = nil
        appleController = nil
        guard let call else { return }
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            call.reject("USER_CANCELED", "USER_CANCELED")
        } else {
            call.reject("Apple sign-in failed: \(error.localizedDescription)")
        }
    }
}

extension NativeAuthPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

extension NativeAuthPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
