/// The Android shell holds the same decision, state and directory rules
/// (`ai.openframe.mobile.ota`), but counts a trial's attempt at boot, where iOS counts it when the
/// scene enters the foreground.
public struct OtaState: Equatable, Sendable {
    public struct Pending: Equatable, Sendable {
        public var version: OtaVersion
        public var attempts: Int

        public init(version: OtaVersion, attempts: Int) {
            self.version = version
            self.attempts = attempts
        }
    }

    public static let schema: Int64 = 1
    public static let maxTrialAttempts = 2
    public static let maxBad = 20

    public var active: OtaVersion?
    public var pending: Pending?
    /// Oldest first.
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

public struct OtaBoot: Equatable, Sendable {
    public var version: OtaVersion?
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

    /// The state returned is to be written before the web view loads. A trial's attempt is not
    /// counted here but when the app comes to the foreground (`countingAttempt`), so that a launch
    /// nobody saw does not use one up.
    public static func resolveBoot(state: OtaState, builtin: OtaVersion, usable: (OtaVersion) -> Bool) -> (state: OtaState, boot: OtaBoot) {
        var next = state
        // A store update installed over them: the built-in bundle is as new or newer.
        if let active = next.active, active <= builtin { next.active = nil }
        if let pending = next.pending, pending.version <= builtin { next.pending = nil }
        next.bad.removeAll { $0 <= builtin }
        // Not marked bad, for the reason `droppingUnbootablePending` gives.
        if let active = next.active, !usable(active) { next.active = nil }
        next = droppingUnbootablePending(next, usable: usable)
        if let pending = next.pending {
            return (next, OtaBoot(version: pending.version, trial: true))
        }
        return (next, OtaBoot(version: next.active, trial: false))
    }

    /// A pending bundle that is not usable is dropped, not marked bad: its directory is gone or
    /// was unpacked under another env, the bundle did not fail.
    private static func droppingUnbootablePending(_ state: OtaState, usable: (OtaVersion) -> Bool) -> OtaState {
        guard let pending = state.pending else { return state }
        var next = state
        if !usable(pending.version) {
            next.pending = nil
        } else if pending.attempts >= OtaState.maxTrialAttempts {
            next = next.markingBad(pending.version)
            next.pending = nil
        }
        return next
    }

    /// Never a trial, which could then fail at every launch without ever being counted and
    /// reverted: the active bundle, which the resolved state names only when it is usable, else
    /// the built-in one.
    public static func bootWithoutWrite(resolved state: OtaState) -> OtaBoot {
        OtaBoot(version: state.active, trial: false)
    }

    public static func countingAttempt(state: OtaState, boot: OtaBoot) -> OtaState {
        var next = state
        if boot.trial, let pending = next.pending, pending.version == boot.version {
            next.pending?.attempts += 1
        }
        return next
    }

    /// Only the trial this page booted from is confirmed: a bundle downloaded during the session
    /// has not run yet.
    public static func applyReady(state: OtaState, boot: OtaBoot) -> OtaState {
        var next = state
        if boot.trial, let pending = next.pending, pending.version == boot.version {
            next.active = pending.version
            next.pending = nil
        }
        return next
    }

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

    public static func applyDownloaded(state: OtaState, version: OtaVersion) -> OtaState {
        var next = state
        next.pending = OtaState.Pending(version: version, attempts: 0)
        return next
    }

    public static func applyRefused(state: OtaState, version: OtaVersion) -> OtaState {
        state.markingBad(version)
    }

    public static func resolveApply(state: OtaState, boot: OtaBoot, usable: (OtaVersion) -> Bool) -> (state: OtaState, version: OtaVersion?) {
        guard let pending = state.pending, pending.version != boot.version else {
            return (state, nil)
        }
        var next = droppingUnbootablePending(state, usable: usable)
        guard next.pending != nil else {
            return (next, nil)
        }
        next.pending?.attempts += 1
        return (next, pending.version)
    }

    /// Never the directory this process serves its web view from.
    public static func directoriesToDelete(present: [String], state: OtaState, boot: OtaBoot) -> [String] {
        let kept = Set([state.active, state.pending?.version, boot.version].compactMap { $0?.description })
        return present.filter { !kept.contains($0) }
    }
}

extension OtaState {
    /// A file that is not exactly what `serialized` writes is an empty state: the bundles it named
    /// are deleted by the next cleanup and downloaded again.
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
