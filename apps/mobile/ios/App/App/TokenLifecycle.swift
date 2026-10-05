import Foundation
import Security
import UIKit

/**
 * Shell-owned token lifecycle: the in-memory pair, the single-flight refresh
 * against the gateway BFF, and the push of every change to the web view.
 *
 * The shell owns refresh so that exactly ONE refresher exists. Refresh tokens
 * rotate (`reuseRefreshTokens(false)`) with no grace window, so two refreshers
 * sharing a credential retire each other's tokens — the frontend's
 * token-refresh-manager delegates to `NativeAuth.refreshTokens` wherever the
 * shell implements it and stops calling /oauth/refresh itself. This mirrors
 * openframe-desktop's `tokens.rs`, minus its sleep detection (a suspended iOS
 * process is not scheduled, so there is nothing to detect from inside it) and
 * plus what a phone needs: a Keychain that cannot be written while the device is
 * locked, a read that may be biometric-gated, and a process that can be
 * suspended mid-request.
 *
 * Every state read and write runs on `TokenStore.queue` — the serial queue that
 * already orders compound Keychain mutations, so a rotation's write cannot
 * interleave with the biometric enable/disable swap. The POST itself runs off
 * the queue; only its outcome comes back onto it.
 */
final class TokenLifecycle {
    static let shared = TokenLifecycle()

    // MARK: - Tunables

    /// Refresh once the access token is within this margin of its `exp`. Same
    /// value as desktop, squeezed from both sides: several poll ticks of slack,
    /// yet a small fraction of the token's 900s life — every rotation is a
    /// chance to lose the session (see `Outcome`).
    static let refreshMargin: TimeInterval = 120
    /// Foreground freshness poll. Runs only while the app is active: a
    /// backgrounded process is not scheduled, and the resume handler covers the
    /// return. This is what replaces the web view's own resume refresh, which
    /// `refreshIfStale()` disables the moment the shell implements
    /// `refreshTokens`.
    static let pollInterval: TimeInterval = 30
    /// Waits between attempts that never reached the gateway; the count sets how
    /// many retries a refresh gets. Only `Outcome.unreached` is retried.
    static let retryDelays: [TimeInterval] = [1, 3]
    /// Total budget for one attempt, enforced against the wall clock rather than
    /// URLSession's own timers: those stop while the process is suspended, and
    /// a POST the app slept through would otherwise hold the single flight for
    /// as long as the suspension lasted. The session's own timeouts are set to
    /// the same value as a belt to these braces.
    static let wallClockBudget: TimeInterval = 10
    /// After a rotation whose answer was lost, how long before the refresh
    /// token may be presented again. The single flight serializes callers but
    /// does not coalesce them: without this the next caller re-presents the
    /// same token the instant the flight ends, which is how an ambiguous
    /// outcome becomes a rejection — and a rejection is a logout.
    static let lostRotationCooldown: TimeInterval = 60

    /// Info.plist key carrying the shared auth host, expanded from the
    /// `OPENFRAME_SHARED_HOST_URL` build setting. The release lanes pass it from
    /// the same `NEXT_PUBLIC_SHARED_HOST_URL` the web bundle bakes, so the two
    /// cannot drift; an Xcode build without it uses the shared host the web view
    /// pushes at login and hydration (`setTenantHost`'s `sharedOrigin`).
    static let sharedHostPlistKey = "OpenFrameSharedHostURL"
    private static let tenantHostDefaultsKey = "ai.openframe.mobile.auth.tenantHost"
    private static let sharedHostDefaultsKey = "ai.openframe.mobile.auth.sharedHost"

    /// Reject codes the web view sees on `refreshTokens`. Every one of them maps
    /// to "transient" there — the session is intact and nothing was cleared.
    enum Code {
        static let unreached = "REFRESH_UNREACHED"
        static let unknown = "REFRESH_UNKNOWN"
        static let held = "REFRESH_HELD"
        static let deviceLocked = "DEVICE_LOCKED"
        static let biometricLocked = "BIOMETRIC_LOCKED"
        static let noHost = "NO_HOST"
        static let sessionReplaced = "SESSION_REPLACED"
    }

    /// What a refresh call settles as, for the caller.
    enum RefreshResult {
        /// The stored pair after the call — rotated, or already fresh.
        case tokens(TokenPair)
        /// The gateway refused the refresh token, or there was none to present:
        /// custody is dropped and the web view must treat this as sign-out.
        case sessionOver
        /// Nothing changed and the stored pair is intact.
        case failed(code: String, message: String)
    }

    /// What one POST to /oauth/refresh settled as. The split between the last two
    /// is the whole point: a refresh is not idempotent — the gateway retires the
    /// presented refresh token the moment it issues the next — so "the request
    /// failed" and "the answer never arrived" are different facts. Retrying the
    /// first costs nothing; retrying the second re-presents a token the server
    /// may already have retired, which comes back as a 401 and reads exactly like
    /// a revoked session.
    private enum Outcome {
        /// Whatever the response headers carried; at least one token is set.
        case rotated(TokenPair)
        /// The gateway refused the refresh token (401).
        case rejected
        /// The gateway never saw it — no network path, DNS, connect, TLS. Safe to retry.
        case unreached(String)
        /// The request went out and its fate is unknown: a broken or timed-out
        /// response, a non-401 error status, or a success carrying no tokens.
        /// Never retried.
        case unknown(String)
    }

    // MARK: - State (on TokenStore.queue)

    private let queue = TokenStore.queue
    /// The pair the process holds. Populated by the first successful read —
    /// which, with biometric login on, is the ONE prompt the web view drives at
    /// launch — and by every write. Read in preference to the Keychain so a
    /// gated store never prompts again for as long as the process lives.
    private var cache: TokenPair?
    /// Bumped whenever custody changes hands (sign-out, or the web view storing
    /// a pair), so a rotation that was in flight can tell the answer it holds
    /// belongs to a session that no longer exists.
    private var sessionEpoch: UInt64 = 0
    /// When the last refresh went out and got no answer back; nil once nothing
    /// is in doubt.
    private var lostRotationAt: Date?
    /// Callers waiting on the refresh in flight; nil when none is. Each records
    /// the session epoch it joined under — see `finish`.
    private var waiters: [Waiter]?
    /// The assertion around the flight, ended by whichever comes first: the
    /// flight settling, or iOS running out of background time.
    private var flightAssertion: UIBackgroundTaskIdentifier = .invalid
    /// Set once iOS ended the flight's background time: whatever comes back
    /// from the wire then settles the flight — no retry without an assertion.
    private var flightExpired = false
    /// A retry the flight is waiting out — cancelled if background time runs
    /// out first, since it has not gone out yet.
    private var pendingRetry: DispatchWorkItem?
    private struct Waiter {
        let epoch: UInt64
        let force: Bool
        let rejectedAccessToken: String?
        let trigger: String
        let completion: (RefreshResult) -> Void
    }
    /// A rotation whose pair could not be written down (a Keychain write can
    /// still fail — before the first unlock after a reboot, or on an error).
    /// Memory is the truth meanwhile; the write is retried on the next
    /// activation and when protected data becomes available.
    private var pendingWrite = false
    /// A silent read was refused in this process (see `Read.unreadable`), so the
    /// web view may be parked behind its lock with nothing to lift it.
    private var readWasRefused = false
    private weak var plugin: NativeAuthPlugin?

    // MARK: - Foreground state (main thread)

    private var pollTimer: Timer?
    private var observersInstalled = false

    private let transport = RefreshTransport()

    private init() {}

    // MARK: - Wiring

    /// Called from the plugin's `load()`. Idempotent.
    func attach(plugin: NativeAuthPlugin) {
        queue.sync { self.plugin = plugin }
        DispatchQueue.main.async { self.installObservers() }
    }

    private func installObservers() {
        guard !observersInstalled else { return }
        observersInstalled = true
        let center = NotificationCenter.default
        center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.startPolling()
            self?.queue.async {
                self?.flushPendingWriteLocked()
                self?.announceIfNewlyReadableLocked()
                self?.refreshIfStaleLocked(trigger: "the app became active")
            }
        }
        center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            self?.stopPolling()
        }
        center.addObserver(forName: UIApplication.protectedDataDidBecomeAvailableNotification, object: nil, queue: .main) { [weak self] _ in
            self?.queue.async { self?.flushPendingWriteLocked() }
        }
        // Already active by the time the bridge loads the plugin, so the
        // notification above has come and gone for this launch.
        if UIApplication.shared.applicationState == .active {
            startPolling()
            queue.async { self.refreshIfStaleLocked(trigger: "launch") }
        }
    }

    private func startPolling() {
        guard pollTimer == nil else { return }
        let timer = Timer(timeInterval: Self.pollInterval, repeats: true) { [weak self] _ in
            self?.queue.async { self?.refreshIfStaleLocked(trigger: "the foreground poll") }
        }
        RunLoop.main.add(timer, forMode: .common)
        pollTimer = timer
    }

    private func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    // MARK: - Reads (for the plugin)

    /// The pair the process already holds, without touching the Keychain.
    func cachedPair() -> TokenPair? {
        queue.sync { cache }
    }

    /// What a silent read finds: the pair, nothing, or an item that cannot be
    /// read right now (a locked device — see `TokenStore.Stored`).
    enum Read {
        case pair(TokenPair)
        case absent
        case unreadable
    }

    /// Read the ungated item, priming the cache. Precondition: biometric login
    /// is off — a gated item would prompt, which is the plugin's decision to
    /// make, not this reader's.
    func readSilently() -> Read {
        queue.sync { readSilentlyLocked() }
    }

    /// Taken before a biometric prompt goes up, so what was read through it can
    /// be told apart from a session that ended while it was up (a sign-out, a
    /// 401): the blob predates that, and must not bring the session back.
    func custodyEpoch() -> UInt64 {
        queue.sync { sessionEpoch }
    }

    /// Adopt a pair the plugin read through the biometric prompt. The cache wins
    /// if something populated it meanwhile (a login, a rotation): the prompted
    /// read is then the older of the two — and so is a read under an epoch that
    /// has since moved on.
    func adopt(promptedRead pair: TokenPair, under epoch: UInt64) -> TokenPair {
        queue.sync {
            adoptLocked(pair, under: epoch)
            return cache ?? TokenPair()
        }
    }

    private func adoptLocked(_ pair: TokenPair, under epoch: UInt64) {
        if cache == nil, sessionEpoch == epoch, !pair.isEmpty { cache = pair }
    }

    private func readSilentlyLocked() -> Read {
        if let cache { return .pair(cache) }
        switch TokenStore.readStored(account: TokenStore.tokensAccount) {
        case .value(let blob):
            let stored = TokenStore.decode(blob)
            guard !stored.isEmpty else { return .absent }
            cache = stored
            return .pair(stored)
        case .absent:
            return .absent
        case .unreadable(let status):
            readWasRefused = true
            ShellLog.auth.error("the token item cannot be read right now (OSStatus \(status)) — a locked device, not an empty store")
            return .unreadable
        }
    }

    /// What a refresh may present, decided without ever prompting.
    private enum Refreshable {
        case pair(TokenPair)
        /// Gated store, nothing unlocked yet: only the web view's launch read can help.
        case gated
        /// Ungated store the device is not letting anyone read: locked.
        case unreadable
        case absent
    }

    /// The pair to refresh with. A background refresh must never drive the
    /// biometric prompt, and must never mistake a locked device for a signed-out
    /// one.
    private func refreshablePairLocked() -> Refreshable {
        if let cache { return .pair(cache) }
        if TokenStore.isBiometricGated { return .gated }
        switch readSilentlyLocked() {
        case .pair(let pair): return .pair(pair)
        case .absent: return .absent
        case .unreadable: return .unreadable
        }
    }

    // MARK: - Writes (for the plugin)

    /// Store a pair the web view hands over (a login). Fields that did not arrive
    /// keep their stored value. This is a custody change: whatever rotation is
    /// in flight belongs to the pair being replaced, and its answer is dropped.
    func store(_ incoming: TokenPair) -> OSStatus {
        queue.sync {
            guard !incoming.isEmpty else { return errSecSuccess }
            // With the store gated and nothing cached, the Keychain cannot be
            // read silently — and need not be: the web view sends the full pair.
            var merged: TokenPair
            if let cache {
                merged = cache
            } else if TokenStore.isBiometricGated {
                merged = TokenPair()
            } else if case .pair(let stored) = readSilentlyLocked() {
                merged = stored
            } else {
                merged = TokenPair()
            }
            let previousRefresh = merged.refresh
            merged.merge(from: incoming)
            sessionEpoch &+= 1
            ShellLog.auth.notice("the web view stored a pair (access: \(incoming.access != nil), refresh: \(incoming.refresh != nil), replaced refresh: \(incoming.refresh != nil && incoming.refresh != previousRefresh))")
            // A refresh token this side never presented settles any doubt exactly
            // as a rotation does — conditional on it actually changing, so the
            // web view re-saving the pair it just read cannot clear a doubt that
            // stands.
            if incoming.refresh != nil, incoming.refresh != previousRefresh {
                lostRotationAt = nil
            }
            cache = merged
            let status = writeLocked(merged)
            pendingWrite = status != errSecSuccess
            return status
        }
    }

    /// Re-store the held pair gated and turn the marker on — the plugin's
    /// biometric enable, after its consent prompt. The pair the process holds,
    /// not a re-read of the blob: a rotation may have landed while the sheet
    /// was up, and a write still pending means the blob is behind. Nothing held
    /// is nothing to gate (`errSecItemNotFound`). A failed write leaves the
    /// marker off and the pair held for the next flush — a write is delete-then-
    /// add, so the item is gone either way, and the marker must say so.
    func gate() -> OSStatus {
        queue.sync {
            guard let cache else { return errSecItemNotFound }
            let status = writeLocked(cache, gated: true)
            pendingWrite = status != errSecSuccess
            guard status == errSecSuccess else { return status }
            TokenStore.setBiometricGated(true)
            return errSecSuccess
        }
    }

    /// The other direction — the plugin's biometric disable, after its prompted
    /// read. The held pair is re-stored ungated and the marker dropped. The read
    /// is the user's consent and, under an unchanged epoch, the fallback for a
    /// process holding nothing; it is never the first choice, since the blob
    /// read before the sheet went up may predate a rotation. Nothing to write
    /// means no session: the item goes, so the marker never reads "ungated" over
    /// an item that is still gated. A failed write leaves the marker on and the
    /// pair held for the next flush, which then rewrites it gated.
    func ungate(promptedRead pair: TokenPair, under epoch: UInt64) -> OSStatus {
        queue.sync {
            adoptLocked(pair, under: epoch)
            if let cache {
                let status = writeLocked(cache, gated: false)
                pendingWrite = status != errSecSuccess
                guard status == errSecSuccess else { return status }
            } else {
                TokenStore.delete(account: TokenStore.tokensAccount)
            }
            TokenStore.setBiometricGated(false)
            return errSecSuccess
        }
    }

    /// Drop custody: cache, Keychain item, biometric marker. The next login
    /// starts from a clean ungated state.
    func endSession() {
        queue.sync { endSessionLocked() }
    }

    private func endSessionLocked() {
        ShellLog.auth.notice("custody dropped — cache, Keychain item and biometric marker cleared")
        cache = nil
        pendingWrite = false
        // The doubt belonged to the token being deleted.
        lostRotationAt = nil
        TokenStore.delete(account: TokenStore.tokensAccount)
        TokenStore.setBiometricGated(false)
        // After the delete, never before: a rotation already past its own
        // snapshot would otherwise see an unchanged epoch and write it back.
        sessionEpoch &+= 1
    }

    private func writeLocked(_ pair: TokenPair, gated: Bool = TokenStore.isBiometricGated) -> OSStatus {
        let status = TokenStore.write(
            account: TokenStore.tokensAccount,
            value: TokenStore.encode(pair),
            gated: gated
        )
        if status != errSecSuccess {
            ShellLog.auth.error("the pair could not be written down (OSStatus \(status)) — holding it in memory")
        }
        return status
    }

    /// A process that launched while the device was locked (a background push
    /// after a kill) holds no pair, and its web view's launch read was refused
    /// with DEVICE_LOCKED — the frontend parks behind its unlock gate. The first
    /// activation after that is on an unlocked device: read the pair now and
    /// push it, so the web view lifts the gate itself instead of waiting for a
    /// tap on a button that promises a biometric it never needed.
    private func announceIfNewlyReadableLocked() {
        guard readWasRefused, cache == nil, !TokenStore.isBiometricGated else { return }
        if case .pair(let pair) = readSilentlyLocked() {
            readWasRefused = false
            ShellLog.auth.notice("the token item became readable — pushing the pair to the web view")
            emit(pair)
        }
    }

    private func flushPendingWriteLocked() {
        guard pendingWrite, let cache else { return }
        if writeLocked(cache) == errSecSuccess {
            pendingWrite = false
            ShellLog.auth.notice("wrote down the pair held in memory")
        }
    }

    // MARK: - Hosts

    /// Persist the login-learned tenant origin. https only, and never taken from
    /// anything but the web view's own login result. The chat endpoints a
    /// notification action calls live only there.
    func setTenantHost(_ origin: String) -> Bool {
        guard let url = Self.httpsOrigin(origin) else { return false }
        UserDefaults.standard.set(url.absoluteString, forKey: Self.tenantHostDefaultsKey)
        return true
    }

    /// Persist the shared auth host the web view itself refreshes against — the
    /// refresh base for a build with no plist host. Not the tenant host, and
    /// never a fallback to it: the tenant host is a DIFFERENT gateway, whose BFF
    /// only puts the rotated pair in the `Access-Token`/`Refresh-Token` headers
    /// when its own `mobile-auth-enabled` flag is on. A refresh sent there can
    /// succeed server-side and come back as a 204 without the tokens — the
    /// refresh token then rotated into cookies this side discards, and the next
    /// refresh is a 401 that ends the session. Observed on stage 2026-09-09.
    func setSharedHost(_ origin: String) -> Bool {
        guard let url = Self.httpsOrigin(origin) else { return false }
        UserDefaults.standard.set(url.absoluteString, forKey: Self.sharedHostDefaultsKey)
        return true
    }

    /// The tenant origin the web view learned at login, or nil before any login.
    func learnedTenantHost() -> URL? {
        guard let learned = UserDefaults.standard.string(forKey: Self.tenantHostDefaultsKey) else { return nil }
        return Self.httpsOrigin(learned)
    }

    /// Where /oauth/refresh lives: the build-pinned shared auth host, else the
    /// one the web view pushed. Nil — and a `NO_HOST` rejection the web view
    /// reads as transient — rather than any other host: see `setSharedHost`.
    private func refreshBase() -> URL? {
        let plist = Bundle.main.object(forInfoDictionaryKey: Self.sharedHostPlistKey) as? String
        if let plist, let url = Self.httpsOrigin(plist) { return url }
        guard let learned = UserDefaults.standard.string(forKey: Self.sharedHostDefaultsKey) else { return nil }
        return Self.httpsOrigin(learned)
    }

    private static func httpsOrigin(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              var components = URLComponents(string: trimmed),
              components.scheme?.lowercased() == "https",
              let host = components.host, !host.isEmpty else {
            return nil
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components.url
    }

    // MARK: - Refresh

    /// Refresh on the web view's behalf. `rejectedAccessToken` is the token the
    /// gateway just refused; when the stored one already differs, a rotation
    /// beat this caller and no request goes out. Nil forces a rotation.
    func refresh(rejectedAccessToken: String?, completion: @escaping (RefreshResult) -> Void) {
        queue.async {
            self.refreshLocked(force: true, rejectedAccessToken: rejectedAccessToken, trigger: "the web view", completion: completion)
        }
    }

    private func refreshIfStaleLocked(trigger: String) {
        refreshLocked(force: false, rejectedAccessToken: nil, trigger: trigger) { _ in }
    }

    /// The pair to act with on the user's behalf — a notification action —
    /// refreshed first when the access token is missing or expiring. Never
    /// prompts: a background caller has nothing to prompt with, and a gated
    /// store the process has not unlocked yet is reported as `BIOMETRIC_LOCKED`.
    func ensureFresh(trigger: String, completion: @escaping (RefreshResult) -> Void) {
        queue.async {
            self.refreshLocked(force: false, rejectedAccessToken: nil, trigger: trigger, completion: completion)
        }
    }

    private func refreshLocked(
        force: Bool,
        rejectedAccessToken: String?,
        trigger: String,
        completion: @escaping (RefreshResult) -> Void
    ) {
        // Join the flight in progress: its answer is newer than anything this
        // caller could obtain by rotating again.
        if waiters != nil {
            waiters?.append(Waiter(epoch: sessionEpoch, force: force, rejectedAccessToken: rejectedAccessToken, trigger: trigger, completion: completion))
            return
        }
        let current: TokenPair
        switch refreshablePairLocked() {
        case .pair(let pair):
            current = pair
        case .gated:
            // Gated and unread. The web view's launch read is what prompts; until
            // it has, a refresh cannot be started — and must not be reported as a
            // dead session, which the web view would answer by wiping the
            // Keychain and turning biometric login off.
            completion(.failed(code: Code.biometricLocked, message: "the tokens are biometric-gated and have not been unlocked yet"))
            return
        case .unreadable:
            // The same answer for the same reason: a background launch that finds
            // a Keychain it may not read yet — before the first unlock after a
            // reboot, or an item still on the old protection class while the
            // phone is locked. The session is intact; say so, never "over".
            completion(.failed(code: Code.deviceLocked, message: "the stored tokens cannot be read until the device has been unlocked"))
            return
        case .absent:
            // Nothing stored at all — the one case that IS signed out.
            current = TokenPair()
        }
        guard let refreshToken = current.refresh else {
            if force {
                ShellLog.auth.error("no refresh token to present — reporting the session over (access present: \(current.access != nil), trigger: \(trigger))")
            }
            completion(force ? .sessionOver : .tokens(current))
            return
        }
        if force {
            // A rotation beat the caller: answered from the pair held, no POST.
            // Only with an access token to hand back — the web view reads a
            // result without one as the session being over.
            if let rejectedAccessToken, let access = current.access, access != rejectedAccessToken {
                completion(.tokens(current))
                return
            }
        } else if !Self.needsRefresh(current) {
            completion(.tokens(current))
            return
        }
        if let lostRotationAt {
            let left = Self.lostRotationCooldown - Date().timeIntervalSince(lostRotationAt)
            if left > 0 {
                ShellLog.auth.notice("refresh held back for \(Int(left.rounded(.up)))s — a rotation's fate is still unknown (trigger: \(trigger))")
                completion(.failed(code: Code.held, message: "a rotation with an unknown outcome is still cooling down"))
                return
            }
        }
        guard let base = refreshBase() else {
            ShellLog.auth.error("no shared host to refresh against — set \(Self.sharedHostPlistKey) (OPENFRAME_SHARED_HOST_URL), or the web view pushes one at hydration (trigger: \(trigger))")
            completion(.failed(code: Code.noHost, message: "no host configured for token refresh"))
            return
        }

        let epoch = sessionEpoch
        waiters = [Waiter(epoch: epoch, force: force, rejectedAccessToken: rejectedAccessToken, trigger: trigger, completion: completion)]
        // One assertion around refresh, retries included: a suspended process
        // loses the request mid-flight, which is precisely `Outcome.unknown`.
        // The handler joins the queue synchronously: UIKit expects the assertion
        // ended before it returns, and nothing on the queue ever waits on main.
        var assertion = UIBackgroundTaskIdentifier.invalid
        assertion = UIApplication.shared.beginBackgroundTask(withName: "ai.openframe.mobile.token-refresh") { [weak self] in
            guard let self else { return }
            queue.sync { self.expireFlightLocked(assertion: assertion, epoch: epoch, trigger: trigger) }
        }
        flightAssertion = assertion
        flightExpired = false
        ShellLog.auth.notice("refreshing (trigger: \(trigger), base: \(base.host ?? "?"))")
        attempt(index: 0, base: base, refreshToken: refreshToken, epoch: epoch, trigger: trigger)
    }

    private func attempt(index: Int, base: URL, refreshToken: String, epoch: UInt64, trigger: String) {
        transport.post(base: base, refreshToken: refreshToken, budget: Self.wallClockBudget) { [weak self] outcome in
            guard let self else { return }
            self.queue.async {
                if case .unreached(let reason) = outcome, index < Self.retryDelays.count, !self.flightExpired {
                    let delay = Self.retryDelays[index]
                    ShellLog.auth.notice("refresh never reached \(base.host ?? "?") (\(reason)) — retrying in \(Int(delay))s")
                    let retry = DispatchWorkItem { [weak self] in
                        guard let self else { return }
                        self.pendingRetry = nil
                        // A sign-out while waiting: do not present its token again.
                        guard self.sessionEpoch == epoch else {
                            self.finish(outcome, epoch: epoch, trigger: trigger)
                            return
                        }
                        self.attempt(index: index + 1, base: base, refreshToken: refreshToken, epoch: epoch, trigger: trigger)
                    }
                    self.pendingRetry = retry
                    self.queue.asyncAfter(deadline: .now() + delay, execute: retry)
                    return
                }
                self.finish(outcome, epoch: epoch, trigger: trigger)
            }
        }
    }

    /// The assertion's expiration handler, on the queue. iOS terminates a process
    /// that lets an assertion lapse, so it is ended here whatever the flight is
    /// doing. A request on the wire is cancelled — its fate is then exactly
    /// unknown, and the flight settles when the cancellation comes back, with
    /// no retry (`flightExpired`). That cancellation is asynchronous, and the
    /// process is about to be suspended: the flight stays open, joinable, until
    /// the resume delivers either the cancel or the wall-clock deadline. A retry
    /// still waiting never went out, so the flight settles as unreached now.
    private func expireFlightLocked(assertion: UIBackgroundTaskIdentifier, epoch: UInt64, trigger: String) {
        // A handler that lost the race with `finish`: the flight settled, and
        // ended this assertion itself.
        guard assertion == flightAssertion else { return }
        flightAssertion = .invalid
        flightExpired = true
        UIApplication.shared.endBackgroundTask(assertion)
        if let pendingRetry {
            pendingRetry.cancel()
            self.pendingRetry = nil
            finish(.unreached("background time ran out before the retry"), epoch: epoch, trigger: trigger)
        } else {
            transport.cancelInFlight(reason: "background time ran out")
        }
    }

    private func finish(_ outcome: Outcome, epoch: UInt64, trigger: String) {
        // This flight's assertion, taken before the waiters run: one of them may
        // start the next flight, whose own assertion must outlive this one.
        let assertion = flightAssertion
        flightAssertion = .invalid
        defer {
            if assertion != .invalid {
                UIApplication.shared.endBackgroundTask(assertion)
            }
        }
        let result = settle(outcome, epoch: epoch, trigger: trigger)
        let pending = waiters ?? []
        waiters = nil
        for waiter in pending {
            if waiter.epoch == epoch {
                waiter.completion(result)
            } else {
                // Joined after custody changed hands — a login stored a new pair
                // while this flight was out. Its answer is about a pair the
                // caller never held, so re-evaluate against the current one:
                // usually answered without a request, since the pair is fresh.
                // The first such caller starts a flight if one is needed; the
                // rest join it.
                refreshLocked(force: waiter.force, rejectedAccessToken: waiter.rejectedAccessToken, trigger: waiter.trigger, completion: waiter.completion)
            }
        }
    }

    private func settle(_ outcome: Outcome, epoch: UInt64, trigger: String) -> RefreshResult {
        // Custody changed hands while this was on the wire — a sign-out, or a
        // fresh login. Either way the answer is about a pair that is gone: a
        // rotation must not be written over the new pair, and a rejection must
        // not clear it.
        guard sessionEpoch == epoch else {
            ShellLog.auth.notice("a refresh settled after the session it belonged to ended — dropping it (trigger: \(trigger))")
            return .failed(code: Code.sessionReplaced, message: "the session changed while the refresh was in flight")
        }
        switch outcome {
        case .rotated(let incoming):
            var merged = cache ?? TokenPair()
            merged.merge(from: incoming)
            cache = merged
            // Whatever an earlier lost rotation did, the pair now held is one the
            // gateway just issued: nothing is in doubt any more.
            lostRotationAt = nil
            // The gateway has already rotated, so the refresh token on disk is
            // spent whether or not this write lands. Memory is the truth; a
            // failed write is retried when protected data returns.
            pendingWrite = writeLocked(merged) != errSecSuccess
            ShellLog.auth.notice("refreshed (trigger: \(trigger), access exp: \(merged.access.flatMap(Self.jwtExpiry).map { "\($0)" } ?? "?"))")
            emit(merged)
            return .tokens(merged)
        case .rejected:
            ShellLog.auth.error("the gateway answered 401 to the refresh (trigger: \(trigger))")
            let why = lostRotationAt != nil
                ? "a refresh whose response was lost had already rotated it"
                : "the gateway rejected the refresh token"
            ShellLog.auth.notice("session over (\(why)) on a refresh (trigger: \(trigger)) — clearing stored tokens")
            endSessionLocked()
            emit(TokenPair())
            return .sessionOver
        case .unreached(let reason):
            return .failed(code: Code.unreached, message: reason)
        case .unknown(let reason):
            // Stamped on every loss, not just the first: each unanswered POST is
            // itself newly in doubt.
            lostRotationAt = Date()
            ShellLog.auth.notice("refresh went out with no usable answer (\(reason)) — holding the token back for \(Int(Self.lostRotationCooldown))s (trigger: \(trigger))")
            return .failed(code: Code.unknown, message: reason)
        }
    }

    /// Push the stored set to the web view — the full pair after a rotation, an
    /// empty set when the session is over — so its cache mirrors what the shell
    /// did while it was idle. Same event contract as the desktop shell's
    /// `native-auth:token-update`.
    private func emit(_ pair: TokenPair) {
        plugin?.notifyListeners("tokenUpdate", data: pair.fields, retainUntilConsumed: false)
    }

    // MARK: - Freshness

    static func needsRefresh(_ pair: TokenPair) -> Bool {
        guard pair.refresh != nil else { return false }
        guard let access = pair.access else { return true }
        // An `exp` that cannot be read is not a schedule — the 401 path owns it.
        guard let exp = jwtExpiry(access) else { return false }
        return Date().addingTimeInterval(refreshMargin) >= exp
    }

    /// `exp` of a JWT, decoded without signature verification — a scheduling
    /// hint about our own token, nothing more.
    static func jwtExpiry(_ token: String) -> Date? {
        guard let exp = jwtPayload(token)?["exp"] as? Double else { return nil }
        return Date(timeIntervalSince1970: exp)
    }

    /// A string claim of our own access token, e.g. `userId` (the user UUID;
    /// `sub` is the email). Same non-verifying read as `jwtExpiry`.
    static func jwtClaim(_ token: String, _ claim: String) -> String? {
        guard let value = jwtPayload(token)?[claim] as? String, !value.isEmpty else { return nil }
        return value
    }

    private static func jwtPayload(_ token: String) -> [String: Any]? {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var payload = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 { payload += "=" }
        guard let data = Data(base64Encoded: payload) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    // MARK: - Transport

    /// The refresh POST and its classification into an `Outcome`.
    ///
    /// Its own session (`URLSessionConfiguration.credentialFree`), with
    /// `waitsForConnectivity` on so that "no network path" is reported by the
    /// framework — the task parks and `taskIsWaitingForConnectivity` fires —
    /// instead of being inferred from an error code: a request that never left
    /// the device is the one outcome that is safe to retry, so it is worth a
    /// definitive signal.
    private final class RefreshTransport: NSObject, URLSessionDataDelegate {
        private lazy var session: URLSession = {
            let config = URLSessionConfiguration.credentialFree
            config.waitsForConnectivity = true
            config.timeoutIntervalForRequest = TokenLifecycle.wallClockBudget
            config.timeoutIntervalForResource = TokenLifecycle.wallClockBudget
            return URLSession(configuration: config, delegate: self, delegateQueue: workQueue)
        }()

        private struct Flight {
            let startedAt: Date
            let completion: (Outcome) -> Void
            var neverLeft = false
            var cancelReason: String?
        }

        /// Keyed by task identifier; touched only on `workQueue`.
        private var flights: [Int: Flight] = [:]
        /// One serial queue for the session's delegate callbacks and every touch
        /// of `flights`, so a completion and the deadline that would cancel it
        /// are ordered rather than raced.
        private let workQueue: OperationQueue

        override init() {
            workQueue = OperationQueue()
            workQueue.maxConcurrentOperationCount = 1
            super.init()
        }

        func post(base: URL, refreshToken: String, budget: TimeInterval, completion: @escaping (Outcome) -> Void) {
            var request = URLRequest(url: base.appendingPathComponent("oauth/refresh"))
            request.httpMethod = "POST"
            request.setValue(refreshToken, forHTTPHeaderField: "Refresh-Token")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            // A body, deliberately: some front ends answer a Content-Length-less
            // POST with 411 before the gateway sees it (found on desktop). The
            // BFF takes no request body, so an empty object is ignored.
            request.httpBody = Data("{}".utf8)
            // No tenantId query param: the BFF resolves the tenant from the token,
            // and a bare UUID in the URL trips the WAF.
            let task = session.dataTask(with: request)
            let startedAt = Date()
            onWorkQueue {
                self.flights[task.taskIdentifier] = Flight(startedAt: startedAt, completion: completion)
                task.resume()
            }
            // The wall-clock deadline. The timer itself is monotonic and fires
            // late after a suspend — which is fine: whichever of it and the
            // completion reaches the delegate queue first wins, and a completion
            // that landed before the suspend is already queued ahead of it.
            onWorkQueue(after: budget + 0.5) {
                guard var flight = self.flights[task.taskIdentifier] else { return }
                guard Date().timeIntervalSince(flight.startedAt) >= budget else { return }
                flight.cancelReason = "refresh outlived its \(Int(budget))s wall-clock budget"
                self.flights[task.taskIdentifier] = flight
                task.cancel()
            }
        }

        /// The expiration handler of the background assertion: the process is
        /// about to be suspended with the request still out, whose fate is then
        /// exactly unknown.
        func cancelInFlight(reason: String) {
            session.getAllTasks { tasks in
                self.onWorkQueue {
                    for task in tasks {
                        guard var flight = self.flights[task.taskIdentifier] else { continue }
                        flight.cancelReason = reason
                        self.flights[task.taskIdentifier] = flight
                        task.cancel()
                    }
                }
            }
        }

        private func onWorkQueue(after delay: TimeInterval = 0, _ block: @escaping () -> Void) {
            if delay > 0 {
                DispatchQueue.global().asyncAfter(deadline: .now() + delay) {
                    self.workQueue.addOperation(block)
                }
            } else {
                workQueue.addOperation(block)
            }
        }

        // MARK: URLSessionTaskDelegate

        // Both arrive on `workQueue` (the session's delegate queue), so `flights`
        // is touched in order with the deadline and the registration in `post`.

        func urlSession(_ session: URLSession, taskIsWaitingForConnectivity task: URLSessionTask) {
            guard var flight = flights[task.taskIdentifier] else { return }
            flight.neverLeft = true
            flights[task.taskIdentifier] = flight
            task.cancel()
        }

        func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
            guard let flight = flights.removeValue(forKey: task.taskIdentifier) else { return }
            flight.completion(Self.classify(response: task.response as? HTTPURLResponse, error: error, flight: flight))
        }

        private static func classify(response: HTTPURLResponse?, error: Error?, flight: Flight) -> Outcome {
            // A pair that made it back settles the rotation even when the
            // connection broke afterwards: the gateway has told us the new pair.
            if let response, (200..<300).contains(response.statusCode), let rotated = rotatedPair(in: response) {
                return .rotated(rotated)
            }
            if flight.neverLeft {
                return .unreached("no network path")
            }
            if let error {
                if let cancelReason = flight.cancelReason {
                    return .unknown(cancelReason)
                }
                let urlError = error as? URLError
                if let urlError, unreachedCodes.contains(urlError.code) {
                    return .unreached(error.localizedDescription)
                }
                return .unknown(error.localizedDescription)
            }
            guard let response else {
                return .unknown("no HTTP response")
            }
            switch response.statusCode {
            case 401:
                return .rejected
            case 200..<300:
                return .unknown("refresh returned no token headers — is mobile auth enabled on the gateway?")
            default:
                // Answered, so a rotation is not ruled out: a 5xx from a front end
                // can sit in front of a gateway that already did the work. A 403
                // is deliberately NOT a rejection — the BFF never answers one on
                // this endpoint, so it is the WAF's, and a WAF verdict says
                // nothing about the credential.
                return .unknown("refresh failed: HTTP \(response.statusCode)")
            }
        }

        /// The rotated pair a refresh response carries. The `Access-Token` /
        /// `Refresh-Token` headers are the bearer-mode contract, but the BFF only
        /// adds them when its own `mobile-auth-enabled` (or `dev-ticket-enabled`)
        /// flag is on — and it sets the SAME pair as cookies on every success. So
        /// the cookies are read as the fallback: a rotation whose tokens are
        /// dropped on the floor is a spent refresh token and, on the next
        /// refresh, a session-ending 401. The session stores no cookies
        /// (`httpCookieStorage = nil`), so they exist only as response headers
        /// here and go nowhere else.
        private static func rotatedPair(in response: HTTPURLResponse) -> TokenPair? {
            let fromHeaders = TokenPair(headersOf: response)
            if !fromHeaders.isEmpty {
                return fromHeaders
            }
            guard let url = response.url,
                  let fields = response.allHeaderFields as? [String: String] else {
                return nil
            }
            let cookies = HTTPCookie.cookies(withResponseHeaderFields: fields, for: url)
            let fromCookies = TokenPair(
                access: cookies.first { $0.name == "access_token" }?.value,
                refresh: cookies.first { $0.name == "refresh_token" }?.value
            )
            return fromCookies.isEmpty ? nil : fromCookies
        }

        /// Everything that ends before the request is on the wire: DNS, the
        /// connect, the TLS handshake, and the policy checks in front of them.
        /// Anything else — a connection lost mid-answer, a timeout — means the
        /// gateway may well have rotated already.
        private static let unreachedCodes: Set<URLError.Code> = [
            .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed, .notConnectedToInternet,
            .internationalRoamingOff, .dataNotAllowed, .callIsActive,
            .secureConnectionFailed, .serverCertificateHasBadDate, .serverCertificateUntrusted,
            .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid,
            .clientCertificateRejected, .clientCertificateRequired,
            .appTransportSecurityRequiresSecureConnection, .badURL, .unsupportedURL,
        ]
    }
}
