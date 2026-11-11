import Foundation

/// When the updater asks the gateway, and whether a check that finds a release may download it on
/// a constrained network: the bookkeeping of `NativeUpdate.check`, with no clock and no queue of
/// its own. The same rules as Android's `CheckSchedule`. Times are wall-clock, so a clock set back
/// makes a check due rather than holding one off.
///
/// The shell's own check runs on the first activation of a process, then when the last one started
/// at least an hour ago. The page's runs unless one has only just finished. Under Low Data Mode the
/// shell's check still asks (a rollback or a kill is all in the manifest) and leaves the download
/// for later; the page's, asked for from the "Update required" screen, downloads all the same.
public struct OtaCheckSchedule: Sendable {
    /// What became of a check that was asked for.
    public enum Asked: Equatable, Sendable {
        /// None runs for it: the last one answers.
        case answered
        /// One is running, and its end answers this one too.
        case joined
        /// It starts now.
        case started
    }

    /// An activation checks again once the last check started this long ago.
    public static let checkEvery: TimeInterval = 60 * 60
    /// A check the page asks for within this long of the last one's end is answered from the state
    /// as it is. The web's "Update required" screen looks again just past it (`LOOK_AGAIN_MS`, 65 s,
    /// in apps/web/src/app/components/update-required-screen.tsx).
    public static let recentCheck: TimeInterval = 60

    private var checking = false
    /// The page asked for the running check or joined it.
    private var pageAsked = false
    /// The running check, or else the last one, left a bundle undownloaded because of Low Data Mode.
    private var downloadDeferred = false
    private var lastStartedAt: Date?
    private var lastFinishedAt: Date?

    public init() {}

    public mutating func ask(fromPage: Bool, now: Date) -> Asked {
        if !checking && !isDue(fromPage: fromPage, now: now) {
            return .answered
        }
        pageAsked = pageAsked || fromPage
        if checking {
            return .joined
        }
        checking = true
        downloadDeferred = false
        lastStartedAt = now
        return .started
    }

    private func isDue(fromPage: Bool, now: Date) -> Bool {
        if fromPage {
            // A check that left its download for later has not answered the page, however recent it is.
            guard let lastFinishedAt, !downloadDeferred else { return true }
            let since = now.timeIntervalSince(lastFinishedAt)
            return since < 0 || since >= Self.recentCheck
        }
        guard let lastStartedAt else { return true }
        let since = now.timeIntervalSince(lastStartedAt)
        return since < 0 || since >= Self.checkEvery
    }

    /// Whether the running check, which has a bundle to download, may download it under Low Data
    /// Mode: only when the user is waiting for it.
    public var mayUseConstrainedNetwork: Bool { pageAsked }

    /// Low Data Mode refused the running check's download.
    public mutating func downloadWasDeferred() {
        downloadDeferred = true
    }

    /// The running check has ended. Returns whether another one starts at once, in its place: the
    /// page joined this one after it had decided on a download Low Data Mode then refused, and is
    /// owed a check that downloads. Its waiters wait on.
    public mutating func finish(now: Date) -> Bool {
        if pageAsked && downloadDeferred {
            downloadDeferred = false
            lastStartedAt = now
            return true
        }
        checking = false
        pageAsked = false
        lastFinishedAt = now
        return false
    }
}
