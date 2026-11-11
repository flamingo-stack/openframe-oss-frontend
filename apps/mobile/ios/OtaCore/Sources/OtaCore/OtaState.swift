/// What the shell remembers about its over-the-air bundles (`state.json`), and every rule that
/// changes it. All of it is pure: the app reads and writes the file and asks the disk whether a
/// bundle is usable (its directory holds an `index.html` that carries this binary's env element,
/// `OtaEnv.page(_:carries:)`); nothing here does. The Android shell holds the same rules
/// (`ai.openframe.mobile.ota`).
public struct OtaState: Equatable, Sendable {
    public struct Pending: Equatable, Sendable {
        public var version: OtaVersion
        /// Boots of this bundle that have not reported ready.
        public var attempts: Int

        public init(version: OtaVersion, attempts: Int) {
            self.version = version
            self.attempts = attempts
        }
    }

    public static let schema: Int64 = 1
    public static let maxTrialAttempts = 2
    public static let maxBad = 20

    /// The bundle that boots: downloaded, booted and confirmed by `notifyReady`.
    public var active: OtaVersion?
    /// A downloaded bundle not yet confirmed. It boots next, as a trial.
    public var pending: Pending?
    /// Versions never to download again, oldest first.
    public var bad: [OtaVersion]

    public init(active: OtaVersion? = nil, pending: Pending? = nil, bad: [OtaVersion] = []) {
        self.active = active
        self.pending = pending
        self.bad = bad
    }

    func markingBad(_ version: OtaVersion) -> OtaState {
        var next = self
        next.bad.removeAll { $0 == version }
        next.bad.append(version)
        next.bad.removeFirst(max(0, next.bad.count - Self.maxBad))
        return next
    }
}

/// What this process serves its web view from.
public struct OtaBoot: Equatable, Sendable {
    /// nil is the built-in bundle.
    public var version: OtaVersion?
    /// A downloaded bundle that has not yet reported ready.
    public var trial: Bool

    public static let builtin = OtaBoot(version: nil, trial: false)

    public init(version: OtaVersion?, trial: Bool) {
        self.version = version
        self.trial = trial
    }
}

public enum OtaDecision: String, Equatable, Sendable {
    case download
    case nothing
    case drop
}

public enum OtaRules {
    /// What a verified manifest asks of the shell (docs/ota.md, "The decision").
    public static func decide(builtin: OtaVersion, bridgeLevel: Int64, state: OtaState, version: OtaVersion, requiredBridgeLevel: Int64) -> OtaDecision {
        if version <= builtin { return .drop }
        if version == state.active || version == state.pending?.version || state.bad.contains(version) { return .nothing }
        if requiredBridgeLevel > bridgeLevel { return .nothing }
        return .download
    }

    /// The bundle a new process boots, and the state to write before its web view loads.
    /// `usable` says whether a bundle can be served by this binary. A trial's attempt is not
    /// counted here but when the app comes to the foreground (`countingAttempt`), so that a launch
    /// nobody saw does not use one up.
    public static func resolveBoot(state: OtaState, builtin: OtaVersion, usable: (OtaVersion) -> Bool) -> (state: OtaState, boot: OtaBoot) {
        var next = state
        // A store update installed over them: the built-in bundle is as new or newer.
        if let active = next.active, active <= builtin { next.active = nil }
        if let pending = next.pending, pending.version <= builtin { next.pending = nil }
        next.bad.removeAll { $0 <= builtin }
        // Dropped, not marked bad: the directory is gone or was unpacked under another env, the
        // bundle did not fail.
        if let active = next.active, !usable(active) { next.active = nil }
        if let pending = next.pending, !usable(pending.version) { next.pending = nil }

        if let pending = next.pending {
            if pending.attempts >= OtaState.maxTrialAttempts {
                next = next.markingBad(pending.version)
                next.pending = nil
            } else {
                return (next, OtaBoot(version: pending.version, trial: true))
            }
        }
        return (next, OtaBoot(version: next.active, trial: false))
    }

    /// The boot when the state `resolveBoot` returned could not be written. Never a trial, which
    /// could then fail at every launch without ever being counted and reverted: the active
    /// bundle, which that state names only when it is usable, else the built-in one.
    public static func bootWithoutWrite(resolved state: OtaState) -> OtaBoot {
        OtaBoot(version: state.active, trial: false)
    }

    /// The attempt of the trial this process booted, counted once the app is in the foreground.
    public static func countingAttempt(state: OtaState, boot: OtaBoot) -> OtaState {
        var next = state
        if boot.trial, let pending = next.pending, pending.version == boot.version {
            next.pending?.attempts += 1
        }
        return next
    }

    /// The booted bundle reports that it works. Only the trial this page booted from is
    /// confirmed: a bundle downloaded during the session has not run yet.
    public static func applyReady(state: OtaState, boot: OtaBoot) -> OtaState {
        var next = state
        if boot.trial, let pending = next.pending, pending.version == boot.version {
            next.active = pending.version
            next.pending = nil
        }
        return next
    }

    /// The state after a decision other than a download.
    public static func applyDecision(_ decision: OtaDecision, state: OtaState, version: OtaVersion, boot: OtaBoot) -> OtaState {
        var next = state
        switch decision {
        case .drop:
            next.active = nil
            next.pending = nil
        case .nothing:
            // The environment went back to the active bundle: a pending one that was never
            // applied must not boot. The trial this process runs is left to report ready.
            if version == next.active, let pending = next.pending, pending.version != version,
               !(boot.trial && boot.version == pending.version) {
                next.pending = nil
            }
        case .download:
            break
        }
        return next
    }

    /// The state once a bundle is verified, unpacked and in place.
    public static func applyDownloaded(state: OtaState, version: OtaVersion) -> OtaState {
        var next = state
        next.pending = OtaState.Pending(version: version, attempts: 0)
        return next
    }

    /// The state after a correctly signed bundle was refused for its content.
    public static func applyRefused(state: OtaState, version: OtaVersion) -> OtaState {
        state.markingBad(version)
    }

    /// `applyPending`: the pending bundle to swap the running web view to, with the same
    /// bookkeeping as a boot. `version` is nil when there is none to apply: no pending bundle, the
    /// one this process already runs, one that is not usable, which is dropped as a boot drops
    /// it, or one that has used up its attempts, which is marked bad.
    public static func resolveApply(state: OtaState, boot: OtaBoot, usable: (OtaVersion) -> Bool) -> (state: OtaState, version: OtaVersion?) {
        guard let pending = state.pending, pending.version != boot.version else {
            return (state, nil)
        }
        var next = state
        guard usable(pending.version) else {
            next.pending = nil
            return (next, nil)
        }
        guard pending.attempts < OtaState.maxTrialAttempts else {
            next = next.markingBad(pending.version)
            next.pending = nil
            return (next, nil)
        }
        next.pending?.attempts += 1
        return (next, pending.version)
    }

    /// The directories of `bundles/` to delete: every one that is not the active bundle, the
    /// pending one or the one this process serves its web view from.
    public static func directoriesToDelete(present: [String], state: OtaState, boot: OtaBoot) -> [String] {
        let kept = Set([state.active, state.pending?.version, boot.version].compactMap { $0?.description })
        return present.filter { !kept.contains($0) }
    }
}

extension OtaState {
    /// The state a `state.json` holds. A file that is not exactly what `serialized` writes is an
    /// empty state: the bundles it named are deleted by the next cleanup and downloaded again.
    public static func parse(_ bytes: [UInt8]) -> OtaState {
        guard let json = StrictJSON.parse(bytes), json["schema"]?.integer == schema,
              let active = version(json["active"]), let bad = json["bad"], case .array(let entries) = bad
        else { return OtaState() }
        var state = OtaState(active: active)
        switch json["pending"] {
        case .some(.null):
            break
        case .some(let pending):
            guard let version = pending["version"]?.stringBytes.flatMap(OtaVersion.init(utf8:)),
                  let attempts = pending["attempts"]?.integer, attempts >= 0, attempts <= Int64(Int32.max)
            else { return OtaState() }
            state.pending = Pending(version: version, attempts: Int(attempts))
        case .none:
            return OtaState()
        }
        for entry in entries {
            guard let version = entry.stringBytes.flatMap(OtaVersion.init(utf8:)) else { return OtaState() }
            state = state.markingBad(version)
        }
        return state
    }

    /// `.some(nil)` for JSON null, nil for anything that is neither null nor a version.
    private static func version(_ value: JSONValue?) -> OtaVersion??  {
        switch value {
        case .some(.null): return .some(nil)
        case .some(.string(let bytes)): return OtaVersion(utf8: bytes).map(Optional.some)
        default: return nil
        }
    }

    public func serialized() -> [UInt8] {
        // Versions are digits and dots, so nothing here needs escaping.
        let quoted = { (version: OtaVersion) in "\"\(version)\"" }
        let pendingText = pending.map { "{\"version\":\(quoted($0.version)),\"attempts\":\($0.attempts)}" } ?? "null"
        let text = "{\"schema\":\(Self.schema),\"active\":\(active.map(quoted) ?? "null"),\"pending\":\(pendingText),"
            + "\"bad\":[\(bad.map(quoted).joined(separator: ","))]}\n"
        return Array(text.utf8)
    }
}
