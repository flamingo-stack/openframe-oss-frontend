/// The `window.__ENV` script element: a shell copies it from its built-in `index.html` into an
/// over-the-air bundle's, so the bundle runs with the env of the lane the binary was built for.
/// One pattern and one insertion point for the release scripts and both shells
/// (`scripts/ota-env.mjs`), matched on bytes: a `String` would match by grapheme.
public enum OtaEnv {
    static let elementStart = Array("<script>window.__ENV".utf8)
    static let elementEnd = Array("</script>".utf8)
    static let headTag = Array("<head>".utf8)

    public static func element(inBuiltin html: [UInt8]) throws -> [UInt8] {
        guard let start = html.offset(of: elementStart),
              let close = html.offset(of: elementEnd, from: start + elementStart.count)
        else {
            throw OtaError(.noEnv, "the built-in index.html has no window.__ENV script")
        }
        return Array(html[start..<close + elementEnd.count])
    }

    public static func checkTarget(_ staged: [UInt8]) throws {
        guard staged.offset(of: elementStart) == nil else {
            throw OtaError(.hasEnv, "the bundle already carries window.__ENV")
        }
        guard staged.offset(of: headTag) != nil else {
            throw OtaError(.noHead, "the bundle's index.html has no <head>")
        }
    }

    public static func insert(element: [UInt8], into staged: [UInt8]) throws -> [UInt8] {
        try checkTarget(staged)
        let cut = staged.offset(of: headTag)! + headTag.count
        return Array(staged[..<cut]) + element + Array(staged[cut...])
    }

    /// A bundle keeps the element of the binary that unpacked it, so after a store update built
    /// for another env it holds a stale one and must not boot.
    public static func page(_ html: [UInt8], carries element: [UInt8]) -> Bool {
        html.offset(of: element) != nil
    }

    /// The built-in page's element is looked for first (NO_ENV), then the staged page is checked.
    public static func copy(builtin: [UInt8], staged: [UInt8]) throws -> [UInt8] {
        try insert(element: element(inBuiltin: builtin), into: staged)
    }
}
