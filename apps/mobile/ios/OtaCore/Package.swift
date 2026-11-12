// swift-tools-version: 5.9
import PackageDescription

// No network, no state on disk, no UIKit. macOS is a platform only so `swift test` runs the shared
// cases on a Mac.
let package = Package(
    name: "OtaCore",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "OtaCore", targets: ["OtaCore"])
    ],
    targets: [
        .target(name: "OtaCore"),
        .testTarget(name: "OtaCoreTests", dependencies: ["OtaCore"])
    ]
)
