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
 * Direct navigation to /405 is redirected by `src/proxy.ts` (it isn't in
 * `isAllowed`), and the proxy deliberately does not run on this internal render
 * (`invokeRender` sets `middlewareInvoke: false`), so both paths are correct.
 *
 * Verified against Next 16.2.4 under `output: 'standalone'` and `'export'`.
 * Remove once upstream stops routing 405s through the error-page renderer.
 */
export default function MethodNotAllowed() {
  return <p>Method Not Allowed</p>;
}
