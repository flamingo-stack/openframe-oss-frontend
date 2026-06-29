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
 *   logins). callbackHost/callbackPath still arrive from JS for the desktop
 *   shell's benefit; iOS ignores them.
 * - exchangeTicket: dev-ticket -> tokens over native HTTP, so the WebView
 *   never fights CORS for the Access-Token/Refresh-Token response headers.
 * - get/set/clearTokens: Keychain storage, WhenUnlockedThisDeviceOnly
 *   (device-bound: excluded from iCloud Keychain sync and backups).
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
        CAPPluginMethod(name: "getSafeAreaInsets", returnType: CAPPluginReturnPromise)
    ]

    // Not auth-related, but this is the shell's only local plugin: WKWebView
    // reports env(safe-area-inset-*) as 0 here, so the frontend asks the
    // native layer for the real insets and sets CSS variables from them.
    @objc func getSafeAreaInsets(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let insets = self.bridge?.viewController?.view.safeAreaInsets ?? .zero
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
    private var authSession: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return
        }
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
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { _, response, error in
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
            var result = JSObject()
            if let accessToken = http.value(forHTTPHeaderField: "Access-Token") {
                result["accessToken"] = accessToken
            }
            if let refreshToken = http.value(forHTTPHeaderField: "Refresh-Token") {
                result["refreshToken"] = refreshToken
            }
            call.resolve(result)
        }.resume()
    }

    // MARK: - Keychain token storage

    private static let service = "ai.openframe.mobile.auth"
    // Both tokens live in ONE Keychain item (a JSON blob) so a gated read shows
    // a single biometric prompt, not one per token.
    private static let tokensAccount = "tokens"
    // Pre-2026-07-22 builds stored access/refresh as two separate items; delete
    // them on write/clear so old gated orphans don't linger.
    private static let legacyAccessTokenAccount = "accessToken"
    private static let legacyRefreshTokenAccount = "refreshToken"

    @objc func getTokens(_ call: CAPPluginCall) {
        // Both tokens live in one item. With biometric login on it carries a
        // .biometryCurrentSet access-control, so the single SecItemCopyMatching
        // drives one Face ID / Touch ID prompt. Off the marker path there's no
        // prompt and a missing item just yields an empty result.
        if Self.biometricGated {
            // The gated read must run off the main thread: the biometric prompt
            // SecItemCopyMatching drives is synchronous and would block the UI.
            DispatchQueue.global(qos: .userInitiated).async {
                let (blob, status) = Self.keychainReadStatus(account: Self.tokensAccount)
                if let code = Self.biometricRejectCode(for: status) {
                    call.reject(code, code)
                    return
                }
                call.resolve(Self.tokensResult(from: blob))
            }
            return
        }
        call.resolve(Self.tokensResult(from: Self.keychainRead(account: Self.tokensAccount)))
    }

    @objc func setTokens(_ call: CAPPluginCall) {
        // The frontend sends the full current pair (token-store mirrors both in
        // memory), so we always write the complete set as ONE item — no gated
        // read-modify-write, so the write stays silent even when gated.
        let blob = Self.encodeTokens(
            access: call.getString("accessToken"),
            refresh: call.getString("refreshToken")
        )
        let status = Self.keychainWrite(account: Self.tokensAccount, value: blob, gated: Self.biometricGated)
        Self.deleteLegacyTokenItems()
        guard status == errSecSuccess else {
            call.reject("Keychain write failed: OSStatus \(status)")
            return
        }
        call.resolve()
    }

    @objc func clearTokens(_ call: CAPPluginCall) {
        Self.keychainDelete(account: Self.tokensAccount)
        Self.deleteLegacyTokenItems()
        // Logout resets to a clean ungated state: the next login writes fresh
        // ungated tokens and the user re-opts into biometric if they want it.
        Self.setBiometricGated(false)
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
        call.resolve(["enabled": Self.biometricGated])
    }

    /// Re-stores the currently-present (ungated) tokens biometric-gated and
    /// flips the marker. Adding a .biometryCurrentSet item does not prompt, so
    /// this is silent. Rejects if biometrics are unavailable or no tokens exist.
    @objc func enableBiometricLogin(_ call: CAPPluginCall) {
        let context = LAContext()
        var laError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &laError) else {
            call.reject("BIOMETRIC_UNAVAILABLE", "BIOMETRIC_UNAVAILABLE")
            return
        }
        // Reading here is safe: the item is still ungated at this point.
        guard let blob = Self.keychainRead(account: Self.tokensAccount) else {
            call.reject("NO_TOKENS", "NO_TOKENS")
            return
        }
        let status = Self.keychainWrite(account: Self.tokensAccount, value: blob, gated: true)
        guard status == errSecSuccess else {
            call.reject("Keychain write failed: OSStatus \(status)")
            return
        }
        Self.setBiometricGated(true)
        call.resolve()
    }

    /// Reads the gated tokens (this prompts) and re-stores them ungated, then
    /// clears the marker. Rejects BIOMETRIC_CANCELED if the user dismisses the
    /// prompt. Runs the gated read off the main thread.
    @objc func disableBiometricLogin(_ call: CAPPluginCall) {
        guard Self.biometricGated else {
            // Already ungated — nothing to do.
            call.resolve()
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let (blob, status) = Self.keychainReadStatus(account: Self.tokensAccount)
            if let code = Self.biometricRejectCode(for: status) {
                call.reject(code, code)
                return
            }
            // Re-store ungated (if anything unlocked), then clear the marker.
            if let blob {
                _ = Self.keychainWrite(account: Self.tokensAccount, value: blob, gated: false)
            }
            Self.setBiometricGated(false)
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
        case errSecItemNotFound, errSecAuthFailed:
            // Enrollment change with .biometryCurrentSet invalidates the ACL:
            // iOS surfaces this either as the item being gone (not-found) or as
            // auth-failed, depending on version.
            return "BIOMETRIC_INVALIDATED"
        default:
            return "BIOMETRIC_CANCELED"
        }
    }

    private static func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private static func keychainRead(account: String) -> String? {
        keychainReadStatus(account: account).0
    }

    /// Read returning the raw OSStatus alongside the value, so the gated path
    /// can tell a user cancel / enrollment-change invalidation apart from a
    /// genuine miss. On the gated path SecItemCopyMatching itself drives the
    /// biometric prompt (the item carries a .biometryCurrentSet access-control),
    /// so this call blocks until the user responds — callers must run it off
    /// the main thread.
    private static func keychainReadStatus(account: String) -> (String?, OSStatus) {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return (nil, status)
        }
        return (String(data: data, encoding: .utf8), status)
    }

    /// Delete-then-add rather than add/update: replacing an item's
    /// access-control (ungated <-> gated) via SecItemUpdate is unreliable, and
    /// adding a fresh .biometryCurrentSet item never prompts — so this stays
    /// silent whether or not `gated` is set.
    private static func keychainWrite(account: String, value: String, gated: Bool) -> OSStatus {
        let data = Data(value.utf8)
        SecItemDelete(baseQuery(account: account) as CFDictionary)
        var query = baseQuery(account: account)
        query[kSecValueData as String] = data
        if gated {
            var acError: Unmanaged<CFError>?
            guard let access = SecAccessControlCreateWithFlags(
                kCFAllocatorDefault,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryCurrentSet,
                &acError
            ) else {
                print("[NativeAuth] keychainWrite(\(account)) access-control creation failed")
                return errSecParam
            }
            query[kSecAttrAccessControl as String] = access
        } else {
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            print("[NativeAuth] keychainWrite(\(account)) failed: \(status)")
        }
        return status
    }

    private static func keychainDelete(account: String) {
        SecItemDelete(baseQuery(account: account) as CFDictionary)
    }

    private static func deleteLegacyTokenItems() {
        keychainDelete(account: legacyAccessTokenAccount)
        keychainDelete(account: legacyRefreshTokenAccount)
    }

    /// Serialize the token pair to a JSON blob for single-item storage. Absent
    /// fields are omitted; the frontend sends the full current pair.
    private static func encodeTokens(access: String?, refresh: String?) -> String {
        var dict: [String: String] = [:]
        if let access { dict["accessToken"] = access }
        if let refresh { dict["refreshToken"] = refresh }
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }

    /// Parse the stored JSON blob into a JS result; empty when nil/unparseable.
    private static func tokensResult(from blob: String?) -> JSObject {
        var result = JSObject()
        guard let blob,
              let data = blob.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return result
        }
        if let access = obj["accessToken"] { result["accessToken"] = access }
        if let refresh = obj["refreshToken"] { result["refreshToken"] = refresh }
        return result
    }

    // MARK: - Biometric marker (non-gated)

    // Records whether the tokens are currently stored biometric-gated. Kept in
    // the same Keychain service but WITHOUT any access-control, so reading it
    // never prompts. A plain-Keychain item (not UserDefaults) keeps the state
    // co-located with, and cleared alongside, the tokens.
    private static let biometricMarkerAccount = "biometricGated"

    private static var biometricGated: Bool {
        keychainRead(account: biometricMarkerAccount) == "1"
    }

    private static func setBiometricGated(_ enabled: Bool) {
        if enabled {
            _ = keychainWrite(account: biometricMarkerAccount, value: "1", gated: false)
        } else {
            keychainDelete(account: biometricMarkerAccount)
        }
    }
}

extension NativeAuthPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
