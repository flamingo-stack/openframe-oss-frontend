import Foundation
import XCTest
@testable import OtaCore

/// When the updater asks the gateway: the cases of Android's `NativeUpdateCheckTimingTest`. The
/// shell's own check runs on the first activation of a process and then at most hourly; a check
/// the page asks for always runs, unless one has only just finished. Low Data Mode holds back the
/// download of the shell's own check, never the asking and never the page's.
final class CheckScheduleTests: XCTestCase {
    private typealias Asked = OtaCheckSchedule.Asked

    private static let minute: TimeInterval = 60
    private static let hour: TimeInterval = 60 * minute
    private let now = Date(timeIntervalSinceReferenceDate: 800_000_000)

    private func at(_ offset: TimeInterval) -> Date {
        now.addingTimeInterval(offset)
    }

    /// A schedule whose last check started at `startedAt` and ended at `finishedAt`, having had
    /// nothing to download.
    private func checkedAt(_ startedAt: TimeInterval, _ finishedAt: TimeInterval) -> OtaCheckSchedule {
        var schedule = OtaCheckSchedule()
        XCTAssertEqual(schedule.ask(fromPage: false, now: at(startedAt)), .started)
        XCTAssertFalse(schedule.finish(now: at(finishedAt)))
        return schedule
    }

    private func ask(_ schedule: OtaCheckSchedule, fromPage: Bool, at offset: TimeInterval) -> Asked {
        var schedule = schedule
        return schedule.ask(fromPage: fromPage, now: at(offset))
    }

    func testTheFirstActivationOfAProcessChecks() {
        XCTAssertEqual(ask(OtaCheckSchedule(), fromPage: false, at: 0), .started)
        var schedule = OtaCheckSchedule()
        XCTAssertEqual(schedule.ask(fromPage: false, now: Date(timeIntervalSince1970: 0)), .started, "whatever the clock reads")
    }

    func testALaterActivationChecksOnceTheLastCheckStartedAnHourAgo() {
        XCTAssertEqual(ask(checkedAt(-Self.hour + 1, -Self.hour + 5), fromPage: false, at: 0), .answered)
        XCTAssertEqual(ask(checkedAt(-Self.hour, -Self.hour + 5), fromPage: false, at: 0), .started)
        XCTAssertEqual(ask(checkedAt(-Self.hour + 1, -1), fromPage: false, at: 0), .answered, "counted from the start of a long check, not its end")
        XCTAssertEqual(ask(checkedAt(-Self.hour, -1), fromPage: false, at: 0), .started)
    }

    func testThePagesCheckRunsUnlessOneFinishedWithinTheLastMinute() {
        XCTAssertEqual(ask(OtaCheckSchedule(), fromPage: true, at: 0), .started)
        XCTAssertEqual(ask(checkedAt(-5 * Self.minute, -Self.minute + 0.001), fromPage: true, at: 0), .answered)
        XCTAssertEqual(ask(checkedAt(-5 * Self.minute, -Self.minute), fromPage: true, at: 0), .started)
        XCTAssertEqual(
            ask(checkedAt(-2 * Self.minute, -Self.minute), fromPage: true, at: 0), .started,
            "an activation check an hour is not due for does not hold the page's back"
        )
    }

    func testAClockSetBackMakesACheckDue() {
        XCTAssertEqual(ask(checkedAt(0, 5), fromPage: false, at: -1), .started, "the shell's")
        XCTAssertEqual(ask(checkedAt(0, 5), fromPage: true, at: 4), .started, "the page's")
    }

    func testACheckAskedForWhileOneRunsJoinsIt() {
        var schedule = OtaCheckSchedule()
        XCTAssertEqual(schedule.ask(fromPage: false, now: at(0)), .started)

        XCTAssertEqual(schedule.ask(fromPage: true, now: at(1)), .joined)
        XCTAssertEqual(schedule.ask(fromPage: false, now: at(2)), .joined)

        XCTAssertFalse(schedule.finish(now: at(3)))
        XCTAssertEqual(schedule.ask(fromPage: true, now: at(4)), .answered, "the one that ran answers the page for the next minute")
    }

    // MARK: - Low Data Mode

    func testWithoutLowDataModeEveryCheckEndsOnce() {
        // Nothing refuses a download, so no check is run again, whoever asked for it.
        var shell = OtaCheckSchedule()
        _ = shell.ask(fromPage: false, now: at(0))
        _ = shell.ask(fromPage: true, now: at(1))
        XCTAssertFalse(shell.finish(now: at(2)))
        var page = OtaCheckSchedule()
        _ = page.ask(fromPage: true, now: at(0))
        XCTAssertFalse(page.finish(now: at(1)))
    }

    func testOnlyThePagesCheckMayDownloadUnderLowDataMode() {
        var shell = OtaCheckSchedule()
        _ = shell.ask(fromPage: false, now: at(0))
        var page = OtaCheckSchedule()
        _ = page.ask(fromPage: true, now: at(0))

        XCTAssertFalse(shell.mayUseConstrainedNetwork)
        XCTAssertTrue(page.mayUseConstrainedNetwork, "the user is looking at the Update Required screen")
    }

    func testACheckThePageJoinedBeforeItsDownloadDownloadsUnderLowDataMode() {
        var schedule = OtaCheckSchedule()
        _ = schedule.ask(fromPage: false, now: at(0))
        XCTAssertEqual(schedule.ask(fromPage: true, now: at(1)), .joined)

        XCTAssertTrue(schedule.mayUseConstrainedNetwork)
        XCTAssertFalse(schedule.finish(now: at(2)), "and it is the page's answer")
    }

    func testACheckThatLeftItsDownloadDoesNotAnswerThePageHoweverRecentItIs() {
        var schedule = OtaCheckSchedule()
        _ = schedule.ask(fromPage: false, now: at(0))
        XCTAssertFalse(schedule.mayUseConstrainedNetwork)
        schedule.downloadWasDeferred()
        XCTAssertFalse(schedule.finish(now: at(1)))

        XCTAssertEqual(schedule.ask(fromPage: false, now: at(2)), .answered, "the shell's own check is not due again for it")
        XCTAssertEqual(schedule.ask(fromPage: true, now: at(2)), .started)
        XCTAssertTrue(schedule.mayUseConstrainedNetwork)
        XCTAssertFalse(schedule.finish(now: at(3)))
        XCTAssertEqual(schedule.ask(fromPage: true, now: at(4)), .answered, "downloaded now, so the last check answers again")
    }

    func testAPageThatJoinsAfterTheDownloadWasLeftGetsACheckThatDownloadsInItsPlace() {
        var schedule = OtaCheckSchedule()
        _ = schedule.ask(fromPage: false, now: at(0))
        XCTAssertFalse(schedule.mayUseConstrainedNetwork)
        schedule.downloadWasDeferred()
        XCTAssertEqual(schedule.ask(fromPage: true, now: at(1)), .joined)

        XCTAssertTrue(schedule.finish(now: at(2)), "another check starts at once, the page still waiting")

        XCTAssertEqual(schedule.ask(fromPage: true, now: at(3)), .joined, "it is running: a further ask joins it")
        XCTAssertTrue(schedule.mayUseConstrainedNetwork)
        XCTAssertFalse(schedule.finish(now: at(4)), "and it ends the waiting")
        XCTAssertEqual(schedule.ask(fromPage: true, now: at(5)), .answered)
    }

    func testAPageThatJoinsWhileTheRefusedDownloadIsUnderWayGetsACheckThatDownloadsInItsPlace() {
        // The download was started without the page's permission, which came while it was refused.
        var schedule = OtaCheckSchedule()
        _ = schedule.ask(fromPage: false, now: at(0))
        XCTAssertFalse(schedule.mayUseConstrainedNetwork)
        XCTAssertEqual(schedule.ask(fromPage: true, now: at(1)), .joined)
        schedule.downloadWasDeferred()

        XCTAssertTrue(schedule.finish(now: at(2)))
        XCTAssertTrue(schedule.mayUseConstrainedNetwork)
        XCTAssertFalse(schedule.finish(now: at(3)))
    }

    func testALaterCheckOfTheShellIsHeldBackByLowDataModeAgain() {
        var schedule = OtaCheckSchedule()
        _ = schedule.ask(fromPage: true, now: at(0))
        XCTAssertTrue(schedule.mayUseConstrainedNetwork)
        _ = schedule.finish(now: at(1))

        XCTAssertEqual(schedule.ask(fromPage: false, now: at(Self.hour)), .started)

        XCTAssertFalse(schedule.mayUseConstrainedNetwork, "the page's wish ended with its check")
    }
}
