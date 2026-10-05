import Foundation
import LocalAuthentication
import Security

/// The session's token pair as the shell holds it. Either half may be absent —
/// a rotation response can carry one token or both — and `merge(from:)` is how
/// an arrival carrying one is applied without blanking the other.
struct TokenPair: Equatable {
    var access: String?
    var refresh: String?

    /// The one spelling of the two halves on every surface: the bridge (a
    /// `getTokens`/`setTokens` result, the `tokenUpdate` event) AND the stored
    /// Keychain blob, deliberately — so renaming a bridge field is a storage
    /// migration for every installed session, not a rename.
    static let accessKey = "accessToken"
    static let refreshKey = "refreshToken"

    var isEmpty: Bool { access == nil && refresh == nil }

    /// The pair keyed by `accessKey`/`refreshKey`. An absent half is omitted,
    /// never nulled, so a partial pair round-trips.
    var fields: [String: String] {
        var dict: [String: String] = [:]
        if let access { dict[Self.accessKey] = access }
        if let refresh { dict[Self.refreshKey] = refresh }
        return dict
    }

    mutating func merge(from incoming: TokenPair) {
        if let access = incoming.access { self.access = access }
        if let refresh = incoming.refresh { self.refresh = refresh }
    }
}

/// An extension so the memberwise `init(access:refresh:)` survives.
extension TokenPair {
    /// The pair as the gateway returns it — the `Access-Token` / `Refresh-Token`
    /// response headers of an exchange or a refresh.
    init(headersOf response: HTTPURLResponse) {
        self.init(
            access: response.value(forHTTPHeaderField: "Access-Token"),
            refresh: response.value(forHTTPHeaderField: "Refresh-Token")
        )
    }
}

/**
 * The app's Keychain accessor for the auth service — the session tokens, the
 * biometric-gating marker, and the legacy items still being swept up.
 *
 * The rule it serves — enforced by the callers, which always `encode` a pair
 * into a single `write` — is that BOTH tokens live in ONE item, so a
 * biometric-gated read drives exactly one prompt (two separately-gated items
 * produced two Face ID prompts on device).
 *
 * It is a separate type because Swift `private` is scoped to the declaring
 * type: as `private static` members of `NativeAuthPlugin` these were
 * unreachable from anywhere else, so a second caller could only duplicate the
 * queries — and a copy that drifts on the gated/ungated or legacy-item rules is
 * exactly the kind of bug that surfaces as a lost session.
 *
 * The storage primitives are deliberately dumb. Policy — when a read may prompt,
 * when to refresh, what a failure means to the session — belongs to the callers.
 */
enum TokenStore {

    private static let service = "ai.openframe.mobile.auth"
    static let tokensAccount = "tokens"

    /// Every item here is device-bound (never in iCloud Keychain or a backup)
    /// and readable from the first unlock after a boot until the next reboot —
    /// `AfterFirstUnlock`, not `WhenUnlocked`. The difference is a notification
    /// action taken from the Watch: it launches the app on the iPhone in the
    /// background while the iPhone stays locked, and a `WhenUnlocked` item
    /// cannot be read there — the action fails, and the launch's token read
    /// comes back empty. What is given up is protection while the phone is
    /// locked-but-booted; the biometric gate (`.biometryCurrentSet`) is
    /// unaffected, and the item still never leaves the device. Decided
    /// 2026-09-09 to make Watch approvals and replies work on a cold start.
    private static let protection = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

    /// Serializes compound Keychain mutations that can race: a token rotation
    /// (setTokens) landing while the enable completion re-gates the item must
    /// land either fully before (the enable re-read sees it) or fully after
    /// (the marker is on, so the rotation writes gated).
    static let queue = DispatchQueue(label: "ai.openframe.mobile.auth.store")

    /// Pre-2026-07-22 builds stored access/refresh as two separate items, either
    /// of which could itself be gated. Both are deleted from `setTokens` and
    /// `clearTokens` so no orphan copy, gated or not, outlives a logout. Retire
    /// them once no install can predate the current scheme.
    ///
    /// These two account names are spelled the same as `TokenPair.accessKey` /
    /// `refreshKey`, because both mirror the JS bridge's field names. They are
    /// different things — a Keychain account versus a key inside the value — and
    /// must not be unified.
    private static let legacyAccessTokenAccount = "accessToken"
    private static let legacyRefreshTokenAccount = "refreshToken"

    // MARK: - Read

    static func read(account: String) -> String? {
        readStatus(account: account).value
    }

    /// What a silent read of an item found. `unreadable` is
    /// `errSecInteractionNotAllowed` and its kin: the item is there and cannot
    /// be seen right now — a background launch before the first unlock after a
    /// reboot, or an item still on the `WhenUnlocked` class it was written with
    /// before 2026-09-09 while the phone is locked. NOT an absent item: treating
    /// it as one is how a background launch on a locked phone once wiped a
    /// live session.
    enum Stored {
        case value(String)
        case absent
        case unreadable(OSStatus)
    }

    static func readStored(account: String) -> Stored {
        let (value, status) = readStatus(account: account)
        switch status {
        case errSecSuccess:
            return value.map { .value($0) } ?? .absent
        case errSecItemNotFound:
            return .absent
        default:
            return .unreadable(status)
        }
    }

    /// Read returning the raw OSStatus alongside the value, so the gated path can
    /// tell a user cancel / enrollment-change invalidation apart from a genuine
    /// miss. On the gated path `SecItemCopyMatching` itself drives the biometric
    /// prompt (the item carries a `.biometryCurrentSet` access-control), so this
    /// call BLOCKS until the user responds — callers must run it off the main
    /// thread.
    static func readStatus(account: String) -> (value: String?, status: OSStatus) {
        let (data, status) = copyMatching(account: account)
        guard let data else { return (nil, status) }
        return (String(data: data, encoding: .utf8), status)
    }

    /// Whether an item exists, WITHOUT prompting. An interaction-disallowed
    /// `LAContext` makes `SecItemCopyMatching` return `errSecInteractionNotAllowed`
    /// — instead of driving the biometric prompt — when the item is present but
    /// auth-gated. (The old spelling, `kSecUseAuthenticationUIFail`, is deprecated
    /// since iOS 14.)
    ///
    /// This disambiguates `errSecAuthFailed`, which is all of a terminal no-match,
    /// a biometry lockout, and (on some iOS versions) an enrollment-change
    /// invalidation: item still present means a retryable auth failure, item gone
    /// means the access-control was invalidated.
    ///
    /// Precondition: the device is unlocked. A locked device returns
    /// `errSecInteractionNotAllowed` for an UNGATED item too, so "present" and
    /// "can't tell" collapse into the same `true`.
    static func existsWithoutPrompting(account: String) -> Bool {
        let context = LAContext()
        context.interactionNotAllowed = true
        let (_, status) = copyMatching(account: account, context: context)
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }

    private static func copyMatching(
        account: String,
        context: LAContext? = nil
    ) -> (data: Data?, status: OSStatus) {
        var query = baseQuery(account: account)
        // Load-bearing for `existsWithoutPrompting`, not just for the read: an
        // attributes-only query never reaches the auth path, so a gated item
        // would return errSecSuccess and collapse the errSecAuthFailed
        // disambiguation that `biometricRejectCode` depends on.
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        if let context {
            query[kSecUseAuthenticationContext as String] = context
        }
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return (nil, status) }
        return (item as? Data, status)
    }

    // MARK: - Write

    /// Replace an item's value.
    ///
    /// Delete-then-add rather than `SecItemUpdate`: swapping an item's
    /// access-control (ungated <-> gated) via update is unreliable, and adding a
    /// fresh `.biometryCurrentSet` item never prompts — so this stays silent
    /// whether or not `gated` is set.
    ///
    /// This leaves a window in which neither value exists, and the add can
    /// genuinely fail (before the first unlock after a reboot, `protection`
    /// blocks writes too). That window is deliberately left open. The
    /// alternative is persisting the new value somewhere recoverable first, which
    /// means persisting it UNGATED (recovery has to re-add it without a prompt):
    /// that puts a biometry-free copy of both live tokens on disk for every gated
    /// user, and lets a stale copy be promoted back — re-gated to whatever
    /// enrollment is current — after `.biometryCurrentSet` had correctly
    /// invalidated the real item. Trading fail-closed invalidation for a
    /// microsecond-wide crash window is the wrong way round.
    ///
    /// A non-success status means the new value was NOT stored, and the previous
    /// value must be assumed gone — the delete's own status is not checked, so
    /// which of the two is actually on disk is unknown.
    static func write(account: String, value: String, gated: Bool) -> OSStatus {
        delete(account: account)
        return add(account: account, value: value, gated: gated)
    }

    /// Precondition: no item exists for `account` — `SecItemAdd` returns
    /// `errSecDuplicateItem` otherwise. `write` guarantees this by deleting first.
    private static func add(account: String, value: String, gated: Bool) -> OSStatus {
        var query = baseQuery(account: account)
        query[kSecValueData as String] = Data(value.utf8)
        if gated {
            var acError: Unmanaged<CFError>?
            guard let access = SecAccessControlCreateWithFlags(
                kCFAllocatorDefault,
                protection,
                .biometryCurrentSet,
                &acError
            ) else {
                let error = acError?.takeRetainedValue()
                ShellLog.auth.error("access-control creation failed for \(account): \(String(describing: error))")
                return errSecParam
            }
            query[kSecAttrAccessControl as String] = access
        } else {
            query[kSecAttrAccessible as String] = protection
        }
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            ShellLog.auth.error("add(\(account)) failed: \(status)")
        }
        return status
    }

    static func delete(account: String) {
        SecItemDelete(baseQuery(account: account) as CFDictionary)
    }

    static func deleteLegacyItems() {
        delete(account: legacyAccessTokenAccount)
        delete(account: legacyRefreshTokenAccount)
    }

    // MARK: - Biometric marker (non-gated)

    /// Records whether the tokens item is currently stored biometric-gated. Kept
    /// in the same Keychain service but WITHOUT any access-control, so reading
    /// it never prompts. A plain Keychain item (not UserDefaults) keeps the state
    /// co-located with, and cleared alongside, the tokens.
    private static let biometricMarkerAccount = "biometricGated"

    /// Conservative when the marker cannot be read (a locked phone and a marker
    /// still on the old protection class): "gated" only ever makes a caller
    /// refuse a silent read, whereas "ungated" would let it try — and on a
    /// gated item that is a biometric prompt no background caller can show.
    static var isBiometricGated: Bool {
        switch readStored(account: biometricMarkerAccount) {
        case .value(let marker): return marker == "1"
        case .absent: return false
        case .unreadable: return true
        }
    }

    /// Posted after every marker flip. The notification action buttons are
    /// registered differently for a gated store (see NotificationActions), and
    /// `setNotificationCategories` replaces the whole set, so they re-register
    /// on it.
    static let biometricGatingDidChange = Notification.Name("ai.openframe.mobile.auth.biometricGatingDidChange")

    static func setBiometricGated(_ enabled: Bool) {
        if enabled {
            _ = write(account: biometricMarkerAccount, value: "1", gated: false)
        } else {
            delete(account: biometricMarkerAccount)
        }
        NotificationCenter.default.post(name: biometricGatingDidChange, object: nil)
    }

    // MARK: - Blob codec

    /// Both tokens in one JSON blob.
    static func encode(_ pair: TokenPair) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: pair.fields),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }

    /// The pair in a stored blob; empty when nil or unparseable.
    static func decode(_ blob: String?) -> TokenPair {
        guard let blob,
              let data = blob.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return TokenPair()
        }
        return TokenPair(access: obj[TokenPair.accessKey], refresh: obj[TokenPair.refreshKey])
    }

    // MARK: - Query

    private static func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
