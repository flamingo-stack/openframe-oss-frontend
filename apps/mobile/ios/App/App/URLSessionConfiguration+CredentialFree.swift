import Foundation

extension URLSessionConfiguration {
    /**
     * The sessions that carry session tokens — the plugin's exchange calls, the
     * refresher, a notification action — carry NO ambient credentials.
     *
     * `URLSession.shared` uses `HTTPCookieStorage.shared`, which the gateway
     * populates with auth cookies on these very endpoints. The exchange calls take
     * a URL from the web layer and hand the response back to it, so borrowing that
     * jar would turn them into a credentialed cross-origin request primitive for
     * anything executing in the WebView — which renders remote Help Center and chat
     * content. The refresher and the actions have no such caller, and no use for
     * the jar either: every one of them reads its tokens off response HEADERS or
     * sends its own bearer. Ephemeral, so nothing lands on disk. Callers add their
     * own timeouts and delegate.
     */
    static var credentialFree: URLSessionConfiguration {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.urlCredentialStorage = nil
        return config
    }
}
