import Foundation
import OtaCore

/**
 * What the binary was built with, and nothing a page script or the network can
 * change.
 */
struct UpdateConfig {
    /// From the built-in bundle's `ota-builtin.json`
    /// (apps/mobile/scripts/ota-stamp.mjs). Nil when the bundle was not built
    /// from a release: such a binary cannot tell whether a release is above or
    /// below what it carries, and takes no updates.
    let builtinVersion: OtaVersion?
    /// Nil when the built-in page has none (the placeholder).
    let envElement: [UInt8]?
    /// Nil without an https `OpenFrameSharedHostURL`. Never the host the web
    /// view pushes (`setTenantHost`): what the app updates from must not come
    /// from JS.
    let manifestURL: URL?
    let keys: [OtaKey]

    private static let manifestPath = "/v0/api/assets/download?agent=mobile&file=mobile.json"

    var enabled: Bool { builtinVersion != nil && envElement != nil && manifestURL != nil }

    static func load(log: ShellLog) -> UpdateConfig {
        let bundle = Bundle.main
        let web = bundle.url(forResource: "public", withExtension: nil)
        let read = { (name: String) in web.flatMap { try? Data(contentsOf: $0.appendingPathComponent(name)) }.map(Array.init) }

        let builtinVersion = read("ota-builtin.json")
            .flatMap(StrictJSON.parse)?["version"]?.stringBytes
            .flatMap(OtaVersion.init(utf8:))
        let envElement = read("index.html").flatMap { try? OtaEnv.element(inBuiltin: $0) }
        let manifestURL = (bundle.object(forInfoDictionaryKey: TokenLifecycle.sharedHostPlistKey) as? String).flatMap(Self.manifestURL)
        var keys: [OtaKey] = []
        do {
            let file = try bundle.url(forResource: "ota-keys", withExtension: "json").map { try Data(contentsOf: $0) }
            keys = try OtaKey.keys(fromKeysJSON: Array(file ?? Data()))
        } catch {
            log.error("no usable public key in ota-keys.json, so no manifest will verify: \(error)")
        }

        let config = UpdateConfig(builtinVersion: builtinVersion, envElement: envElement, manifestURL: manifestURL, keys: keys)
        log.notice(
            "over-the-air updates \(config.enabled ? "on" : "off"): built-in bundle \(builtinVersion?.description ?? "not a release"), "
                + "env element \(envElement == nil ? "missing" : "present"), shared host \(manifestURL?.host ?? "not https or not set"), "
                + "keys \(keys.map(\.id).joined(separator: " "))"
        )
        return config
    }

    /// The host must be an https origin: the manifest URL is built on it as text.
    private static func manifestURL(sharedHost: String) -> URL? {
        var origin = sharedHost[...]
        while origin.hasSuffix("/") { origin = origin.dropLast() }
        guard origin.utf8.starts(with: "https://".utf8),
              let components = URLComponents(string: String(origin)),
              let host = components.host, !host.isEmpty,
              components.user == nil, components.password == nil,
              components.path.isEmpty, components.query == nil, components.fragment == nil
        else { return nil }
        return URL(string: origin + manifestPath)
    }
}

/**
 * No cookies and no credentials (`URLSessionConfiguration.credentialFree`), no
 * headers of its own, https at every hop, and never more than `limit` bytes of
 * body.
 */
final class UpdateFetch: NSObject, URLSessionDataDelegate {
    struct Failure: Error, CustomStringConvertible {
        let description: String
        var lowDataMode = false
    }

    private let limit: Int64
    private let file: FileHandle?
    private let completion: (Result<Data, Failure>) -> Void
    private var body = Data()
    private var received: Int64 = 0
    private var failure: Failure?

    private init(limit: Int64, file: FileHandle?, completion: @escaping (Result<Data, Failure>) -> Void) {
        self.limit = limit
        self.file = file
        self.completion = completion
    }

    static func get(_ url: URL, limit: Int64, into file: FileHandle? = nil, constrained: Bool, timeout: TimeInterval, on queue: DispatchQueue, completion: @escaping (Result<Data, Failure>) -> Void) {
        guard isHTTPS(url) else {
            queue.async { completion(.failure(Failure(description: "not an https URL"))) }
            return
        }
        let configuration = URLSessionConfiguration.credentialFree
        configuration.allowsConstrainedNetworkAccess = constrained
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = min(timeout, 30)
        configuration.timeoutIntervalForResource = timeout
        let callbacks = OperationQueue()
        callbacks.underlyingQueue = queue
        callbacks.maxConcurrentOperationCount = 1
        let fetch = UpdateFetch(limit: limit, file: file, completion: completion)
        let session = URLSession(configuration: configuration, delegate: fetch, delegateQueue: callbacks)
        session.dataTask(with: url).resume()
        // The session holds its delegate until the task is done, then lets go.
        session.finishTasksAndInvalidate()
    }

    private static func isHTTPS(_ url: URL?) -> Bool {
        url?.scheme?.lowercased() == "https" && url?.host?.isEmpty == false
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        // Refused, the redirect itself becomes the answer, and a 3xx is no update.
        completionHandler(Self.isHTTPS(request.url) ? request : nil)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
            failure = Failure(description: "HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0)")
            completionHandler(.cancel)
            return
        }
        guard response.expectedContentLength <= limit else {
            failure = Failure(description: "\(response.expectedContentLength) bytes announced, at most \(limit) expected")
            completionHandler(.cancel)
            return
        }
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard failure == nil else { return }
        received += Int64(data.count)
        guard received <= limit else {
            failure = Failure(description: "more than the \(limit) bytes expected")
            dataTask.cancel()
            return
        }
        guard let file else {
            body.append(data)
            return
        }
        do {
            try file.write(contentsOf: data)
        } catch {
            failure = Failure(description: "the download could not be written: \(Self.brief(error))")
            dataTask.cancel()
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let failure {
            completion(.failure(failure))
        } else if let error {
            let lowDataMode = (error as? URLError)?.networkUnavailableReason == .constrained
            completion(.failure(Failure(description: Self.brief(error), lowDataMode: lowDataMode)))
        } else {
            completion(.success(body))
        }
    }

    /// Domain and code only: an NSError's text can carry the URL it failed on,
    /// and the manifest URL has a query, which the log never shows.
    static func brief(_ error: Error) -> String {
        let error = error as NSError
        return "\(error.domain) \(error.code)"
    }
}

/**
 * Which bundle a manifest means, and what becomes of the state, is
 * `NativeUpdate`'s: nothing here reads or writes `state.json`.
 */
struct UpdateChecker {
    private static let manifestTimeout: TimeInterval = 15
    /// 4.5 MB today; a slow link still finishes, a dead one does not hang a check.
    private static let bundleTimeout: TimeInterval = 600
    private static let archiveName = "bundle.tar.xz"

    let config: UpdateConfig
    let store: UpdateStore
    let log: ShellLog

    /// Asked under Low Data Mode too: it is a few hundred bytes, and a kill or a
    /// rollback needs nothing else.
    func fetchManifest(on queue: DispatchQueue, completion: @escaping (OtaPayload?) -> Void) {
        guard let url = config.manifestURL else {
            queue.async { completion(nil) }
            return
        }
        UpdateFetch.get(url, limit: Int64(OtaManifest.maxBytes), constrained: true, timeout: Self.manifestTimeout, on: queue) { result in
            switch result {
            case .failure(let failure):
                log.notice("no manifest from \(url.host ?? "?"): \(failure)")
                completion(nil)
            case .success(let body):
                do {
                    let payload = try OtaManifest.verify(Array(body), keys: config.keys)
                    log.notice("manifest verified: release \(payload.version), bridge level \(payload.bridgeLevel), \(payload.size) bytes")
                    completion(payload)
                } catch {
                    log.error("manifest refused: \(error)")
                    completion(nil)
                }
            }
        }
    }

    enum Download {
        case archive(URL)
        /// Megabytes the user did not ask for, under Low Data Mode: not fetched.
        case heldForLowDataMode
        case failed
    }

    func download(_ payload: OtaPayload, constrained: Bool, on queue: DispatchQueue, completion: @escaping (Download) -> Void) {
        let archive = store.staging.appendingPathComponent(Self.archiveName)
        guard let url = URL(string: payload.url),
              FileManager.default.createFile(atPath: archive.path, contents: nil, attributes: UpdateStore.unprotected),
              let file = try? FileHandle(forWritingTo: archive)
        else {
            log.error("\(payload.version): the download could not start")
            queue.async { completion(.failed) }
            return
        }
        log.notice("downloading \(payload.version) from \(url.host ?? "?")")
        UpdateFetch.get(url, limit: payload.size, into: file, constrained: constrained, timeout: Self.bundleTimeout, on: queue) { result in
            try? file.close()
            switch result {
            case .failure(let failure) where failure.lowDataMode:
                log.notice("\(payload.version): download skipped: Low Data Mode is on. It is taken once it is off, or when the page asks")
                completion(.heldForLowDataMode)
            case .failure(let failure):
                log.notice("\(payload.version): download failed: \(failure)")
                completion(.failed)
            case .success:
                completion(.archive(archive))
            }
        }
    }

    /// Throws an `OtaError` for a refusal, anything else for a failure of the
    /// disk or of the decoder to start, which says nothing about the bundle.
    func unpack(_ archive: URL, payload: OtaPayload) throws -> URL {
        guard let envElement = config.envElement else {
            throw OtaError(.noEnv, "the built-in index.html has no window.__ENV script")
        }
        let directory = store.staging.appendingPathComponent(payload.version.description, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: UpdateStore.unprotected)
        let index = try OtaBundle.unpack(fileAt: archive, size: payload.size, sha256: payload.sha256, into: DirectorySink(root: directory))
        let page = try OtaEnv.insert(element: envElement, into: index)
        try Data(page).write(to: directory.appendingPathComponent("index.html"), options: [.atomic, .noFileProtection])
        return directory
    }
}
