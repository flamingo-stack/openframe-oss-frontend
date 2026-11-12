import Foundation

/// The same rules as Android's `CheckSchedule`. Times are wall-clock, so a clock set back makes a
/// check due rather than holding one off.
///
/// Under Low Data Mode the shell's check still asks (a rollback or a kill is all in the manifest)
/// and leaves the download for later; the page's, asked for from the "Update required" screen,
/// downloads all the same.
public struct OtaCheckSchedule: Sendable {
    public enum Asked: Equatable, Sendable {
        /// None runs for it: the last one answers.
        case answered
        case joined
        case started
    }

    public static let checkEvery: TimeInterval = 60 * 60
    /// The web's "Update required" screen looks again just past it (`LOOK_AGAIN_MS`, 65 s, in
    /// apps/web/src/app/components/update-required-screen.tsx).
    public static let recentCheck: TimeInterval = 60

    private var checking = false
    private var pageAsked = false
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

    public var mayUseConstrainedNetwork: Bool { pageAsked }

    public mutating func downloadWasDeferred() {
        downloadDeferred = true
    }

    /// Returns whether another check starts at once, in its place: the page joined this one after
    /// it had decided on a download Low Data Mode then refused, and is owed a check that downloads.
    /// Its waiters wait on.
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
