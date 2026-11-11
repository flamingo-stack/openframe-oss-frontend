import XCTest
@testable import OtaCore

private func v(_ text: String) -> OtaVersion { OtaVersion(text)! }

private func pending(_ text: String, _ attempts: Int = 0) -> OtaState.Pending {
    OtaState.Pending(version: v(text), attempts: attempts)
}

final class ResolveBootTests: XCTestCase {
    private let builtin = v("1.2.0")
    private let everyBundle: (OtaVersion) -> Bool = { _ in true }

    private func boot(_ state: OtaState, usable: ((OtaVersion) -> Bool)? = nil) -> (state: OtaState, boot: OtaBoot) {
        OtaRules.resolveBoot(state: state, builtin: builtin, usable: usable ?? everyBundle)
    }

    private func launch(_ state: OtaState) -> (state: OtaState, boot: OtaBoot) {
        let result = boot(state)
        return (OtaRules.countingAttempt(state: result.state, boot: result.boot), result.boot)
    }

    func testNoBundlesBootsBuiltin() {
        let result = boot(OtaState())
        XCTAssertEqual(result.state, OtaState())
        XCTAssertEqual(result.boot, .builtin)
    }

    func testActiveBootsWithoutATrial() {
        let state = OtaState(active: v("1.2.3"))
        let result = boot(state)
        XCTAssertEqual(result.state, state)
        XCTAssertEqual(result.boot, OtaBoot(version: v("1.2.3"), trial: false))
    }

    func testPendingBootsAsATrialAndTheBootCountsNoAttempt() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4"))
        let result = boot(state)
        XCTAssertEqual(result.state, state)
        XCTAssertEqual(result.boot, OtaBoot(version: v("1.2.4"), trial: true))
    }

    func testTheForegroundCountsTheAttemptOfTheTrialThisProcessBooted() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4"))
        let trial = OtaBoot(version: v("1.2.4"), trial: true)
        XCTAssertEqual(OtaRules.countingAttempt(state: state, boot: trial), OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1)))
        // Not a trial, or a pending bundle this process does not run: nothing to count.
        XCTAssertEqual(OtaRules.countingAttempt(state: state, boot: OtaBoot(version: v("1.2.3"), trial: false)), state)
        XCTAssertEqual(OtaRules.countingAttempt(state: state, boot: .builtin), state)
        XCTAssertEqual(OtaRules.countingAttempt(state: state, boot: OtaBoot(version: v("1.2.5"), trial: true)), state)
        XCTAssertEqual(OtaRules.countingAttempt(state: OtaState(active: v("1.2.3")), boot: trial), OtaState(active: v("1.2.3")))
    }

    func testLaunchesNobodySawUseNoAttempt() {
        var state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1))
        for _ in 0..<5 {
            let result = boot(state)
            XCTAssertEqual(result.boot, OtaBoot(version: v("1.2.4"), trial: true))
            state = result.state
        }
        XCTAssertEqual(state, OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1)))
    }

    func testTheSecondAttemptStillBoots() {
        let result = launch(OtaState(pending: pending("1.2.4", 1)))
        XCTAssertEqual(result.state, OtaState(pending: pending("1.2.4", 2)))
        XCTAssertEqual(result.boot, OtaBoot(version: v("1.2.4"), trial: true))
    }

    func testABundleThatUsedUpItsAttemptsIsMarkedBadAndTheActiveOneBoots() {
        let result = boot(OtaState(active: v("1.2.3"), pending: pending("1.2.4", 2)))
        XCTAssertEqual(result.state, OtaState(active: v("1.2.3"), bad: [v("1.2.4")]))
        XCTAssertEqual(result.boot, OtaBoot(version: v("1.2.3"), trial: false))
    }

    func testABundleThatUsedUpItsAttemptsFallsBackToBuiltinWithoutAnActiveOne() {
        let result = boot(OtaState(pending: pending("1.2.4", 2)))
        XCTAssertEqual(result.state, OtaState(bad: [v("1.2.4")]))
        XCTAssertEqual(result.boot, .builtin)
    }

    func testThreeLaunchesWithoutReadyRevertTheBundle() {
        var state = OtaState(active: v("1.2.3"), pending: pending("1.2.4"))
        var boots: [OtaBoot] = []
        for _ in 0..<3 {
            let result = launch(state)
            state = result.state
            boots.append(result.boot)
        }
        XCTAssertEqual(boots, [
            OtaBoot(version: v("1.2.4"), trial: true),
            OtaBoot(version: v("1.2.4"), trial: true),
            OtaBoot(version: v("1.2.3"), trial: false)
        ])
        XCTAssertEqual(state, OtaState(active: v("1.2.3"), bad: [v("1.2.4")]))
    }

    func testAStoreUpdateDropsBundlesAtOrBelowItsBuiltinVersion() {
        let state = OtaState(active: v("1.2.0"), pending: pending("1.1.9", 1), bad: [v("1.1.0"), v("1.2.0"), v("1.2.5")])
        let result = boot(state)
        XCTAssertEqual(result.state, OtaState(bad: [v("1.2.5")]))
        XCTAssertEqual(result.boot, .builtin)
    }

    func testVersionsCompareAsNumbers() {
        let result = OtaRules.resolveBoot(state: OtaState(active: v("1.10.0")), builtin: v("1.9.0"), usable: everyBundle)
        XCTAssertEqual(result.boot, OtaBoot(version: v("1.10.0"), trial: false))
        let dropped = OtaRules.resolveBoot(state: OtaState(active: v("1.9.0")), builtin: v("1.10.0"), usable: everyBundle)
        XCTAssertEqual(dropped.boot, .builtin)
        XCTAssertEqual(dropped.state, OtaState())
    }

    func testAnActiveBundleThatIsNotUsableIsDroppedNotMarkedBad() {
        let result = boot(OtaState(active: v("1.2.3")), usable: { _ in false })
        XCTAssertEqual(result.state, OtaState())
        XCTAssertEqual(result.boot, .builtin)
    }

    func testAPendingBundleThatIsNotUsableIsDroppedNotMarkedBad() {
        for attempts in 0...3 {
            let result = boot(OtaState(active: v("1.2.3"), pending: pending("1.2.4", attempts)), usable: { $0 == v("1.2.3") })
            XCTAssertEqual(result.state, OtaState(active: v("1.2.3")), "\(attempts) attempts")
            XCTAssertEqual(result.boot, OtaBoot(version: v("1.2.3"), trial: false))
        }
    }

    func testAUsedUpPendingBundleOverAnActiveOneThatIsNotUsableBootsBuiltin() {
        let result = boot(OtaState(active: v("1.2.3"), pending: pending("1.2.4", 2)), usable: { $0 == v("1.2.4") })
        XCTAssertEqual(result.state, OtaState(bad: [v("1.2.4")]))
        XCTAssertEqual(result.boot, .builtin)
    }

    private func eachBoot(_ body: (_ result: (state: OtaState, boot: OtaBoot), _ usable: (OtaVersion) -> Bool) -> Void) {
        let versions = ["1.2.3", "1.2.4"].map(v)
        for activeUsable in [true, false] {
            for pendingUsable in [true, false] {
                for attempts in 0...3 {
                    let usable = { (version: OtaVersion) in version == versions[0] ? activeUsable : pendingUsable }
                    let state = OtaState(active: versions[0], pending: OtaState.Pending(version: versions[1], attempts: attempts))
                    body(boot(state, usable: usable), usable)
                }
            }
        }
    }

    func testTheBootVersionIsAlwaysUsable() {
        eachBoot { result, usable in
            if let version = result.boot.version {
                XCTAssertTrue(usable(version))
            }
        }
    }

    func testABootWhoseStateCannotBeWrittenIsTheActiveBundleNotATrial() {
        let resolved = boot(OtaState(active: v("1.2.3"), pending: pending("1.2.4")))
        XCTAssertEqual(resolved.boot, OtaBoot(version: v("1.2.4"), trial: true))
        XCTAssertEqual(OtaRules.bootWithoutWrite(resolved: resolved.state), OtaBoot(version: v("1.2.3"), trial: false))
    }

    func testABootWhoseStateCannotBeWrittenIsBuiltinWithoutAUsableActiveBundle() {
        let none = boot(OtaState(pending: pending("1.2.4")))
        XCTAssertEqual(OtaRules.bootWithoutWrite(resolved: none.state), .builtin)
        let unusable = boot(OtaState(active: v("1.2.3"), pending: pending("1.2.4")), usable: { $0 == v("1.2.4") })
        XCTAssertEqual(OtaRules.bootWithoutWrite(resolved: unusable.state), .builtin)
        let replaced = OtaRules.resolveBoot(state: OtaState(active: v("1.2.3"), pending: pending("1.2.4")), builtin: v("1.2.3"), usable: everyBundle)
        XCTAssertEqual(OtaRules.bootWithoutWrite(resolved: replaced.state), .builtin)
    }

    func testABootWhoseStateCannotBeWrittenIsNeverATrialAndAlwaysUsable() {
        eachBoot { result, usable in
            let fallback = OtaRules.bootWithoutWrite(resolved: result.state)
            XCTAssertFalse(fallback.trial)
            if let version = fallback.version {
                XCTAssertTrue(usable(version))
                XCTAssertEqual(version, v("1.2.3"))
            }
        }
    }
}

final class StateRulesTests: XCTestCase {
    func testReadyConfirmsTheTrialThisProcessBooted() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1))
        let next = OtaRules.applyReady(state: state, boot: OtaBoot(version: v("1.2.4"), trial: true))
        XCTAssertEqual(next, OtaState(active: v("1.2.4")))
    }

    func testReadyFromAnActiveOrBuiltinBootChangesNothing() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4"))
        XCTAssertEqual(OtaRules.applyReady(state: state, boot: OtaBoot(version: v("1.2.3"), trial: false)), state)
        XCTAssertEqual(OtaRules.applyReady(state: state, boot: .builtin), state)
    }

    func testReadyDoesNotConfirmABundleDownloadedDuringTheSession() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.5"))
        XCTAssertEqual(OtaRules.applyReady(state: state, boot: OtaBoot(version: v("1.2.4"), trial: true)), state)
    }

    func testDropForgetsEveryBundleAndKeepsTheBadList() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1), bad: [v("1.2.2")])
        let next = OtaRules.applyDecision(.drop, state: state, version: v("1.2.0"), boot: .builtin)
        XCTAssertEqual(next, OtaState(bad: [v("1.2.2")]))
    }

    func testNothingForTheActiveVersionForgetsAnUnappliedPendingBundle() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4"))
        let boot = OtaBoot(version: v("1.2.3"), trial: false)
        XCTAssertEqual(OtaRules.applyDecision(.nothing, state: state, version: v("1.2.3"), boot: boot), OtaState(active: v("1.2.3")))
    }

    func testNothingForTheActiveVersionKeepsTheTrialThisProcessRuns() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1))
        let boot = OtaBoot(version: v("1.2.4"), trial: true)
        XCTAssertEqual(OtaRules.applyDecision(.nothing, state: state, version: v("1.2.3"), boot: boot), state)
    }

    func testNothingForAnyOtherVersionChangesNothing() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4"), bad: [v("1.2.5")])
        let boot = OtaBoot(version: v("1.2.3"), trial: false)
        for version in ["1.2.4", "1.2.5", "1.2.6"] {
            XCTAssertEqual(OtaRules.applyDecision(.nothing, state: state, version: v(version), boot: boot), state, version)
        }
        XCTAssertEqual(OtaRules.applyDecision(.download, state: state, version: v("1.2.6"), boot: boot), state)
    }

    func testADownloadedBundleBecomesPendingWithNoAttempts() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1))
        XCTAssertEqual(OtaRules.applyDownloaded(state: state, version: v("1.2.5")), OtaState(active: v("1.2.3"), pending: pending("1.2.5")))
    }

    func testTheBadListKeepsItsTwentyMostRecent() {
        var state = OtaState()
        for patch in 1...25 {
            state = OtaRules.applyRefused(state: state, version: v("1.2.\(patch)"))
        }
        XCTAssertEqual(state.bad, (6...25).map { v("1.2.\($0)") })
        state = OtaRules.applyRefused(state: state, version: v("1.2.6"))
        XCTAssertEqual(state.bad.count, 20)
        XCTAssertEqual(state.bad.last, v("1.2.6"))
    }

    func testApplyTakesThePendingBundleAndCountsTheAttempt() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4"))
        let result = OtaRules.resolveApply(state: state, boot: OtaBoot(version: v("1.2.3"), trial: false), usable: { _ in true })
        XCTAssertEqual(result.version, v("1.2.4"))
        XCTAssertEqual(result.state, OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1)))
    }

    func testApplyHasNothingWithoutAPendingBundleToSwitchTo() {
        let active = OtaBoot(version: v("1.2.3"), trial: false)
        let none = OtaState(active: v("1.2.3"))
        let nothing = OtaRules.resolveApply(state: none, boot: active, usable: { _ in true })
        XCTAssertNil(nothing.version)
        XCTAssertEqual(nothing.state, none)

        let booted = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1))
        for usable in [true, false] {
            let already = OtaRules.resolveApply(state: booted, boot: OtaBoot(version: v("1.2.4"), trial: true), usable: { _ in usable })
            XCTAssertNil(already.version)
            XCTAssertEqual(already.state, booted)
        }
    }

    func testApplyDropsAPendingBundleThatIsNotUsable() {
        let active = OtaBoot(version: v("1.2.3"), trial: false)
        // Whatever its attempts: it did not fail, so it is not marked bad and downloads again.
        for attempts in 0...3 {
            let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", attempts), bad: [v("1.2.2")])
            let result = OtaRules.resolveApply(state: state, boot: active, usable: { $0 == v("1.2.3") })
            XCTAssertNil(result.version, "\(attempts) attempts")
            XCTAssertEqual(result.state, OtaState(active: v("1.2.3"), bad: [v("1.2.2")]), "\(attempts) attempts")
            // Asked again, there is nothing left to refuse.
            XCTAssertEqual(OtaRules.resolveApply(state: result.state, boot: active, usable: { _ in false }).state, result.state)
        }
    }

    func testApplyMarksABundleThatUsedUpItsAttemptsBad() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 2))
        let result = OtaRules.resolveApply(state: state, boot: OtaBoot(version: v("1.2.3"), trial: false), usable: { _ in true })
        XCTAssertNil(result.version)
        XCTAssertEqual(result.state, OtaState(active: v("1.2.3"), bad: [v("1.2.4")]))
    }

    func testCleanupKeepsTheActiveThePendingAndTheBootedDirectory() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.5"))
        let present = ["1.2.2", "1.2.3", "1.2.4", "1.2.5", "junk", "01.2.3"]
        XCTAssertEqual(
            OtaRules.directoriesToDelete(present: present, state: state, boot: OtaBoot(version: v("1.2.4"), trial: true)),
            ["1.2.2", "junk", "01.2.3"]
        )
        XCTAssertEqual(OtaRules.directoriesToDelete(present: present, state: OtaState(), boot: .builtin), present)
    }

    func testADroppedBundleThatIsStillRunningKeepsItsDirectory() {
        let boot = OtaBoot(version: v("1.2.3"), trial: false)
        let state = OtaRules.applyDecision(.drop, state: OtaState(active: v("1.2.3")), version: v("1.2.0"), boot: boot)
        XCTAssertEqual(OtaRules.directoriesToDelete(present: ["1.2.3"], state: state, boot: boot), [])
    }
}

final class StateFileTests: XCTestCase {
    func testAStateSurvivesTheFile() {
        let states = [
            OtaState(),
            OtaState(active: v("1.2.3")),
            OtaState(active: v("1.10.0"), pending: pending("999999999.0.1", 2), bad: [v("1.2.4"), v("1.2.5")])
        ]
        for state in states {
            XCTAssertEqual(OtaState.parse(state.serialized()), state)
        }
    }

    func testTheFileIsTheDocumentedShape() {
        let state = OtaState(active: v("1.2.3"), pending: pending("1.2.4", 1), bad: [v("1.2.2")])
        XCTAssertEqual(
            String(decoding: state.serialized(), as: UTF8.self),
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":{\"version\":\"1.2.4\",\"attempts\":1},\"bad\":[\"1.2.2\"]}\n"
        )
        XCTAssertEqual(
            String(decoding: OtaState().serialized(), as: UTF8.self),
            "{\"schema\":1,\"active\":null,\"pending\":null,\"bad\":[]}\n"
        )
    }

    func testAFileThatDoesNotParseIsAnEmptyState() {
        let files = [
            "",
            "not json",
            "[]",
            "{\"schema\":2,\"active\":\"1.2.3\",\"pending\":null,\"bad\":[]}",
            "{\"schema\":true,\"active\":\"1.2.3\",\"pending\":null,\"bad\":[]}",
            "{\"schema\":1,\"active\":\"1.2\",\"pending\":null,\"bad\":[]}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"bad\":[]}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":\"1.2.4\",\"bad\":[]}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":{\"version\":\"1.2.4\",\"attempts\":-1},\"bad\":[]}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":{\"version\":\"1.2.4\",\"attempts\":true},\"bad\":[]}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":null,\"bad\":[\"../1.2.3\"]}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":null,\"bad\":null}",
            "{\"schema\":1,\"active\":\"1.2.3\",\"pending\":null,\"bad\":[]} trailing"
        ]
        for file in files {
            XCTAssertEqual(OtaState.parse(Array(file.utf8)), OtaState(), file)
        }
    }

    func testAFileWithALongBadListKeepsTheMostRecent() {
        let bad = (1...30).map { "\"1.2.\($0)\"" }.joined(separator: ",")
        let state = OtaState.parse(Array("{\"schema\":1,\"active\":null,\"pending\":null,\"bad\":[\(bad)]}".utf8))
        XCTAssertEqual(state.bad, (11...30).map { v("1.2.\($0)") })
    }
}

final class VersionTests: XCTestCase {
    func testTheGrammar() {
        for text in ["0.0.0", "1.2.3", "10.20.30", "999999999.999999999.999999999"] {
            XCTAssertEqual(OtaVersion(text)?.description, text)
        }
        for text in ["", "1", "1.2", "1.2.3.4", "01.2.3", "1.02.3", "1.2.03", "1.2.3 ", " 1.2.3", "1.2.3\n", "+1.2.3", "-1.2.3",
                     "1.2.3-rc.1", "1.2.1000000000", "1..3", "1.2.", ".2.3", "1.2.٣", "v1.2.3", "1.2.x"] {
            XCTAssertNil(OtaVersion(text), text)
        }
    }

    func testTheOrder() {
        XCTAssertLessThan(v("1.9.0"), v("1.10.0"))
        XCTAssertLessThan(v("1.99.99"), v("2.0.0"))
        XCTAssertLessThan(v("1.2.3"), v("1.2.4"))
        XCTAssertEqual(v("1.2.3"), v("1.2.3"))
        XCTAssertFalse(v("1.2.3") < v("1.2.3"))
    }
}
