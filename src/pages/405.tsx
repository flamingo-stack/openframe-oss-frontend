/**
 * Pages Router shim for HTTP 405 — not a user-facing page.
 *
 * When a non-GET/HEAD request hits an asset that EXISTS under `/_next/static/`,
 * Next's router (`next/dist/server/lib/router-server.js`) does the right thing
 * first — sets `Allow: GET, HEAD` and `statusCode = 405` — then renders `/405`
 * as a *status page*. That lookup is
 * `findPageComponents({ page: '/405', isAppPath: false })`, falling back to
 * `/_error`. An App-Router-only build has neither, so Next throws
 * `WrappedBuildError('missing required error components')` and its own handler
 * turns that into `500 Internal Server Error` — silently, because wrapped build
 * errors skip `logError`. The giveaway is a 500 still carrying `Allow: GET,
 * HEAD`.
 *
 * Without this file, `POST /_next/static/chunks/<real-chunk>.js` answers 500,
 * so anyone who loads the page can harvest a chunk URL and mint backend 5xx at
 * will, polluting error rates and masking real incidents. A scanner did exactly
 * that against dev on 2026-08-06 (27 requests, 4 seconds).
 *
 * `isAppPath: false` is the reason this lives in `src/pages` and not `src/app`:
 * an `app/405/page.tsx` is invisible to the status-page lookup — verified, it
 * builds and serves at /405 while the 500 persists.
 *
 * Direct navigation to /405 is NOT blocked by `src/proxy.ts`: `isAllowed` is a
 * mode gate, not a page allowlist - in `oss-tenant` it returns true for every
 * path, in `saas-tenant` for everything outside `/auth`, so the shim is
 * reachable by URL and renders as a bare 200 page. That is cosmetic only -
 * nothing links to it. The proxy deliberately does not run on the internal
 * status-page render (`invokeRender` sets `middlewareInvoke: false`), so
 * blocking /405 in the proxy would not break the 405 path if we ever want to
 * hide it.
 *
 * Verified against Next 16.2.4 under `output: 'standalone'` and `'export'`.
 * Remove once upstream stops routing 405s through the error-page renderer.
 */
export default function MethodNotAllowed() {
  return <p>Method Not Allowed</p>;
}
