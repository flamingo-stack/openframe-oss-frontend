import Foundation
import OtaCore
import UIKit

/**
 * Over-the-air web bundles: apps/mobile/docs/ota.md.
 *
 * A process singleton, because none of this belongs to a web view: the boot
 * decision is made before one exists.
 *
 * Nothing here takes a path, a URL, a host or a key from JS.
 *
 * Threads: `queue` owns every field and every write of the state; the main
 * thread joins it once per bridge (`bootDirectory`) and each time the scene
 * comes to the foreground, for work of a few milliseconds. `worker` runs
 * what is slow (unpacking, deleting directories) one block at a time, and
 * steps onto `queue` for the state. `queue` never waits on either of the
 * other two.
 */
final class NativeUpdate {
    static let shared = NativeUpdate()

    /// Raised by one in the same change as any bridge addition a bundle may
    /// come to require; a release whose `REQUIRED_BRIDGE_LEVEL` is above it is
    /// not downloaded.
    static let bridgeLevel: Int64 = 1

    struct Snapshot {
        let enabled: Bool
        let builtinVersion: String?
        let bootedVersion: String?
        let trial: Bool
        let activeVersion: String?
        let pendingVersion: String?

        var json: [String: Any] {
            [
                "enabled": enabled,
                "builtinVersion": builtinVersion ?? NSNull(),
                "bridgeLevel": NativeUpdate.bridgeLevel,
                "bootedVersion": bootedVersion ?? NSNull(),
                "trial": trial,
                "activeVersion": activeVersion ?? NSNull(),
                "pendingVersion": pendingVersion ?? NSNull()
            ]
        }
    }

    private let queue = DispatchQueue(label: "ai.openframe.mobile.update")
    private let worker = DispatchQueue(label: "ai.openframe.mobile.update.work", qos: .utility)
    private let log = ShellLog.update
    private let store = UpdateStore()
    private lazy var config = UpdateConfig.load(log: log)

    private var state: OtaState?
    private var boot: OtaBoot?
    private var attemptCounted = true
    private var schedule = OtaCheckSchedule()
    private var checkWaiters: [(Snapshot) -> Void] = []
    private var checkAssertion = UIBackgroundTaskIdentifier.invalid
    private var observing = false

    private init() {}

    // MARK: - Wiring

    /// Called from `AppDelegate.didFinishLaunching`, on the main thread. The app
    /// uses the scene lifecycle, so activations come as notifications.
    func start() {
        guard !observing else { return }
        observing = true
        // Without an operation queue the block runs inside the post, which UIKit
        // makes on the main thread, and it joins `queue`: the attempt is on disk
        // before the main thread can take a call from the page. A cold launch
        // into the foreground posts this too, unlike the application's own
        // willEnterForeground.
        NotificationCenter.default.addObserver(forName: UIScene.willEnterForegroundNotification, object: nil, queue: nil) { [weak self] _ in
            self?.queue.sync { self?.countAttemptLocked() }
        }
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.queue.async { self?.activatedLocked() }
        }
    }

    // MARK: - Boot

    func bootDirectory() -> URL? {
        queue.sync {
            guard let version = resolveBootLocked().version else { return nil }
            // Capacitor exits the process when the directory it is given has no
            // index.html, so it is looked at again each time a bridge is built.
            guard usableLocked(version) else {
                log.error("bundle \(version) is no longer usable: the built-in bundle runs for the rest of this process")
                boot = .builtin
                return nil
            }
            return store.bundleDirectory(version)
        }
    }

    private func resolveBootLocked() -> OtaBoot {
        if let boot { return boot }
        let resolved = resolveLocked()
        boot = resolved
        attemptCounted = !resolved.trial
        if config.builtinVersion != nil {
            let trial = resolved.trial ? ", a trial: its attempt is counted once the app is in the foreground" : ""
            log.notice("booting \(resolved.version.map { "bundle \($0)" } ?? "the built-in bundle")\(trial)")
            worker.async { self.store.wipeStaging() }
            scheduleCleanup()
        }
        return resolved
    }

    private func resolveLocked() -> OtaBoot {
        guard let builtin = config.builtinVersion else { return .builtin }
        // A state that cannot be read right now says nothing about what is safe
        // to boot, and writing over it would lose it.
        guard let state = stateLocked() else { return .builtin }
        let resolved = OtaRules.resolveBoot(state: state, builtin: builtin, usable: usableOrLoggedLocked)
        if let reverted = state.pending?.version, !state.bad.contains(reverted), resolved.state.bad.contains(reverted) {
            log.error("bundle \(reverted) never reported ready in \(OtaState.maxTrialAttempts) boots: marked bad")
        }
        // A trial's attempt is counted later, in the foreground, so the boot
        // proves here that it can be: the state is written even when the boot
        // changed nothing in it. A trial that could not be counted could fail
        // at every launch and never be reverted.
        guard persistLocked(resolved.state, always: resolved.boot.trial) else {
            let fallback = OtaRules.bootWithoutWrite(resolved: resolved.state)
            if let trial = resolved.boot.version, resolved.boot.trial {
                log.error("bundle \(trial) does not boot on trial: its attempt could not be recorded. \(fallback.version.map { "The active bundle \($0)" } ?? "The built-in bundle") boots")
            }
            return fallback
        }
        return resolved.boot
    }

    private func usableLocked(_ version: OtaVersion) -> Bool {
        store.isUsable(version, envElement: config.envElement)
    }

    private func usableOrLoggedLocked(_ version: OtaVersion) -> Bool {
        let usable = usableLocked(version)
        if !usable {
            log.error("bundle \(version) is not usable (no index.html, or one unpacked under another env): dropped, the next check downloads it again")
        }
        return usable
    }

    private func countAttemptLocked() {
        let boot = resolveBootLocked()
        guard boot.trial, !attemptCounted, let state = stateLocked() else { return }
        let next = OtaRules.countingAttempt(state: state, boot: boot)
        guard persistLocked(next) else { return }
        attemptCounted = true
        if let pending = next.pending, next != state {
            log.notice("bundle \(pending.version) is in the foreground on trial: attempt \(pending.attempts) of \(OtaState.maxTrialAttempts) counted")
        }
    }

    // MARK: - JS surface (NativeUpdatePlugin)

    func snapshot(_ completion: @escaping (Snapshot) -> Void) {
        queue.async { completion(self.snapshotLocked()) }
    }

    func notifyReady(_ completion: @escaping () -> Void) {
        queue.async {
            if let boot = self.boot, boot.trial, let state = self.stateLocked() {
                let next = OtaRules.applyReady(state: state, boot: boot)
                if next != state, self.persistLocked(next) {
                    self.boot?.trial = false
                    self.log.notice("bundle \(boot.version?.description ?? "?") reported ready: now the active bundle")
                }
            }
            self.scheduleCleanup()
            completion()
        }
    }

    func check(_ completion: @escaping (Snapshot) -> Void) {
        queue.async {
            guard self.askLocked(fromPage: true, trigger: "the page asked") != .answered else {
                completion(self.snapshotLocked())
                return
            }
            self.checkWaiters.append(completion)
        }
    }

    func applyPending(_ completion: @escaping (URL?) -> Void) {
        queue.async {
            guard let boot = self.boot, self.config.builtinVersion != nil, let state = self.stateLocked() else {
                completion(nil)
                return
            }
            let resolved = OtaRules.resolveApply(state: state, boot: boot, usable: self.usableOrLoggedLocked)
            guard self.persistLocked(resolved.state) else {
                completion(nil)
                return
            }
            guard let version = resolved.version else {
                self.log.notice("applyPending: no pending bundle to apply")
                completion(nil)
                return
            }
            self.boot = OtaBoot(version: version, trial: true)
            self.attemptCounted = true
            self.log.notice("applying bundle \(version) in this process, a trial")
            completion(self.store.bundleDirectory(version))
        }
    }

    private func snapshotLocked() -> Snapshot {
        let state = config.builtinVersion == nil ? nil : stateLocked()
        return Snapshot(
            enabled: config.enabled,
            builtinVersion: config.builtinVersion?.description,
            bootedVersion: boot?.version?.description,
            trial: boot?.trial ?? false,
            activeVersion: state?.active?.description,
            pendingVersion: state?.pending?.version.description
        )
    }

    // MARK: - The check

    private func activatedLocked() {
        // Counted as the scene came to the foreground; this is the second try of
        // a count that could not be written then.
        countAttemptLocked()
        _ = askLocked(fromPage: false, trigger: "the app became active")
    }

    /// Answered when no check can run (updates are off, or the state cannot be
    /// read), before the schedule would count one as started. Once a check can
    /// run one always can (the boot, the config and a state once read stay), so
    /// a check in flight is always joined.
    private func askLocked(fromPage: Bool, trigger: String) -> OtaCheckSchedule.Asked {
        guard boot != nil, config.enabled, stateLocked() != nil else { return .answered }
        let asked = schedule.ask(fromPage: fromPage, now: Date())
        if asked == .started {
            runCheckLocked(trigger: trigger)
        }
        return asked
    }

    private func runCheckLocked(trigger: String) {
        // A check that began in the foreground gets to finish its download and
        // unpack after the user leaves; cut short, it starts over next time. One
        // run again for the page keeps the assertion of the run before it.
        // The handler joins the queue synchronously: UIKit expects the assertion
        // ended before it returns, and nothing on the queue ever waits on main.
        if checkAssertion == .invalid {
            checkAssertion = UIApplication.shared.beginBackgroundTask(withName: "ai.openframe.mobile.update-check") { [weak self] in
                self?.queue.sync { self?.endAssertionLocked() }
            }
        }
        log.notice("checking for an update (\(trigger))")
        let checker = UpdateChecker(config: config, store: store, log: log)
        worker.async { self.runCheck(checker) }
    }

    private func endAssertionLocked() {
        guard checkAssertion != .invalid else { return }
        UIApplication.shared.endBackgroundTask(checkAssertion)
        checkAssertion = .invalid
    }

    private func runCheck(_ checker: UpdateChecker) {
        do {
            try store.resetStaging()
        } catch {
            log.error("the staging directory could not be made: \(UpdateFetch.brief(error))")
            finishCheck()
            return
        }
        checker.fetchManifest(on: worker) { payload in
            guard let payload,
                  let mayUseConstrainedNetwork = self.queue.sync(execute: { self.decideLocked(payload) ? self.schedule.mayUseConstrainedNetwork : nil })
            else {
                self.finishCheck()
                return
            }
            checker.download(payload, constrained: mayUseConstrainedNetwork, on: self.worker) { download in
                switch download {
                case .archive(let archive):
                    self.install(archive, payload: payload, checker: checker)
                case .heldForLowDataMode:
                    self.queue.sync { self.schedule.downloadWasDeferred() }
                case .failed:
                    break
                }
                self.finishCheck()
            }
        }
    }

    /// True when the manifest's bundle is to be downloaded.
    private func decideLocked(_ payload: OtaPayload) -> Bool {
        guard let builtin = config.builtinVersion, let boot, let state = stateLocked() else { return false }
        let decision = OtaRules.decide(
            builtin: builtin, bridgeLevel: Self.bridgeLevel, state: state,
            version: payload.version, requiredBridgeLevel: payload.bridgeLevel
        )
        log.notice("release \(payload.version): \(decision.rawValue)")
        guard decision == .download else {
            _ = persistLocked(OtaRules.applyDecision(decision, state: state, version: payload.version, boot: boot))
            return false
        }
        // Verified in full before it was moved into place, so its being there
        // and usable is enough. Only ever the directory this process still runs
        // from after a drop: one left by a crash between the move and the state
        // write is named by nothing, and the cleanup at boot has deleted it.
        if usableLocked(payload.version) {
            log.notice("bundle \(payload.version) is already on disk: pending without a download")
            _ = persistLocked(OtaRules.applyDownloaded(state: state, version: payload.version))
            return false
        }
        return true
    }

    private func install(_ archive: URL, payload: OtaPayload, checker: UpdateChecker) {
        let staged: URL
        do {
            staged = try checker.unpack(archive, payload: payload)
        } catch let refusal as OtaError {
            log.error("bundle \(payload.version) refused: \(refusal)")
            // Refused for what it holds, it would be refused again at every launch.
            if refusal.isContentRefusal {
                queue.sync {
                    guard let state = stateLocked() else { return }
                    _ = persistLocked(OtaRules.applyRefused(state: state, version: payload.version))
                }
            }
            return
        } catch {
            log.error("bundle \(payload.version) could not be unpacked: \(UpdateFetch.brief(error))")
            return
        }
        queue.sync {
            guard let state = stateLocked() else { return }
            // Its directory is the one the web view is served from: never replaced.
            guard boot?.version != payload.version else {
                log.error("bundle \(payload.version) is the one running: not replaced")
                return
            }
            do {
                // The move, then the state: a crash between them leaves a directory
                // the cleanup at the next boot deletes, never a pending bundle that
                // is not there.
                try store.install(staged: staged, as: payload.version)
            } catch {
                log.error("bundle \(payload.version) could not be moved into place: \(UpdateFetch.brief(error))")
                return
            }
            if persistLocked(OtaRules.applyDownloaded(state: state, version: payload.version)) {
                log.notice("bundle \(payload.version) is pending: it runs from the next launch")
            }
        }
    }

    private func finishCheck() {
        store.wipeStaging()
        cleanUp()
        queue.async {
            if self.schedule.finish(now: Date()) {
                self.runCheckLocked(trigger: "the page joined a check whose download Low Data Mode held")
                return
            }
            let snapshot = self.snapshotLocked()
            let waiters = self.checkWaiters
            self.checkWaiters = []
            waiters.forEach { $0(snapshot) }
            self.endAssertionLocked()
        }
    }

    // MARK: - Directories

    private func scheduleCleanup() {
        worker.async { self.cleanUp() }
    }

    /// On `worker`, like every step that makes a directory count (a bundle moved
    /// into place or adopted), so the list cannot go stale before it is used.
    private func cleanUp() {
        let doomed: [String] = queue.sync {
            guard let boot, let state = stateLocked() else { return [] }
            return OtaRules.directoriesToDelete(present: store.bundleNames(), state: state, boot: boot)
        }
        guard !doomed.isEmpty else { return }
        store.removeBundles(named: doomed)
        log.notice("deleted bundle directories: \(doomed.joined(separator: " "))")
    }

    // MARK: - State

    private func stateLocked() -> OtaState? {
        if let state { return state }
        switch store.readState() {
        case .state(let read):
            state = read
            return read
        case .unreadable(let error):
            log.error("state.json cannot be read right now: \(UpdateFetch.brief(error))")
            return nil
        }
    }

    private func persistLocked(_ next: OtaState, always: Bool = false) -> Bool {
        guard always || next != state else { return true }
        do {
            try store.writeState(next)
            state = next
            return true
        } catch {
            log.error("state.json could not be written: \(UpdateFetch.brief(error))")
            return false
        }
    }
}
