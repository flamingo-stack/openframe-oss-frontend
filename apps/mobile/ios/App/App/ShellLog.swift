import Foundation
import os

/**
 * The shell's own log: the unified logging system, mirrored to stdout in
 * Debug builds.
 *
 * The session machinery — refresh, custody, notification actions — runs while
 * no Xcode console is attached: in the background after a notification button,
 * on a device in the field. `Logger` persists at `.notice` and above, so a
 * report reads back afterwards:
 *
 *     xcrun simctl spawn booted log show --last 30m \
 *       --predicate 'subsystem == "ai.openframe.mobile"'
 *
 * (Console.app with the same subsystem filter on a device.) The stdout mirror
 * is for the consoles that only carry stdout — Xcode's, and
 * `xcrun devicectl device process launch --console`, which is how a real
 * device's output is read without root. Everything logged here is a host, a
 * code or a status — never a token — so it is all public.
 */
struct ShellLog {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "ai.openframe.mobile"
    static let auth = ShellLog(category: "auth")
    static let notifications = ShellLog(category: "notifications")

    private let category: String
    private let logger: Logger

    private init(category: String) {
        self.category = category
        self.logger = Logger(subsystem: Self.subsystem, category: category)
    }

    func notice(_ message: String) {
        logger.notice("\(message, privacy: .public)")
        mirror(message)
    }

    func error(_ message: String) {
        logger.error("\(message, privacy: .public)")
        mirror(message)
    }

    private func mirror(_ message: String) {
        #if DEBUG
        print("[\(category)] \(message)")
        #endif
    }
}
