/**
 * Standalone-server entrypoint. Wraps Next's generated `server.js`.
 *
 * WHY THIS EXISTS
 * Next 16.2.4 answers a non-GET/HEAD request for an **existing** static file
 * with `500 Internal Server Error` instead of `405`. In
 * `next/dist/server/lib/router-server.js` (~line 402) it correctly sets
 * `Allow: GET, HEAD` + `statusCode = 405`, then calls
 * `invokeRender('/405', { invokeStatus: 405 })`. That lands in base-server's
 * *error-page* renderer, which resolves status pages via
 * `findPageComponents({ page: '/405', isAppPath: false })` — Pages Router only,
 * falling back to `/_error`. An App-Router-only build has neither, so Next throws
 * `WrappedBuildError('missing required error components')`, catches its own
 * error, and degrades to a 500. The `Allow: GET, HEAD` it already set survives on
 * the wire. Nothing is logged, because the catch skips `logError` for wrapped
 * build errors.
 *
 * The branch sits inside `if (matchedOutput?.fsPath && matchedOutput.itemPath)`,
 * so it covers **every** file Next serves off disk — both `/_next/static/` chunks
 * and anything in `public/` (`/robots.txt`, `/assets/*`, `/icons/*`). Asset URLs
 * are harvested straight from the page HTML, so any anonymous client can mint
 * unlimited backend 5xx. Observed in dev 2026-08-06: 27 requests in a 4-second
 * burst from one scanner, ~7% of all dev backend 500s that week.
 *
 * HOW THE REPAIR IS SCOPED
 * We do not guess from the URL which paths are static. We key on Next's own
 * fingerprint: a response with status 500 that already carries an `Allow` header.
 * Only two places in Next set `Allow` server-side — `router-server.js:402` (this
 * bug) and `base-server.js:1306` (the page path, which sends its 405 immediately
 * and never degrades) — and both set 405 in the same breath. A 500 carrying
 * `Allow` is therefore unambiguously this bug, and nothing else can match.
 *
 * Because the trigger is the response rather than the path, behaviour elsewhere
 * is untouched: a non-GET for a *nonexistent* file still returns 404, server
 * actions still POST to page routes, `POST /` still returns its own clean 405.
 * The stale `ETag` (computed for the asset, not for this body) is dropped and
 * `Content-Length` corrected, so the 405 is a well-formed response.
 *
 * WHAT WE DO NOT DO
 * - `src/app/405/page.tsx` — tested, does not work; `isAppPath: false` hides the
 *   App Router from the status-page lookup.
 * - `src/pages/405.tsx` — works at runtime, but introducing a `pages/` directory
 *   flips `next/navigation`'s `useSearchParams()` to `ReadonlyURLSearchParams |
 *   null` and breaks type-check in 67 files.
 * - Widening the `src/proxy.ts` matcher to cover static paths — tested, works,
 *   but roughly doubles static-asset latency and drags every JS chunk behind
 *   `isAllowed()`, whose redirect-to-`/` logic would then be one edit away from
 *   white-screening the app.
 * - Upgrading Next — reproduced unchanged on 16.2.12 and 16.3.0.
 * - Injecting `/405` into `pages-manifest.json` — tested, no effect; the
 *   `404.html`/`500.html` entries feed a different code path.
 * - Cloud Armor / Gateway API — neither can emit a 405 at all.
 *
 * FAILURE MODE
 * This hooks `http.createServer`. If a future Next builds its listener some other
 * way (`new http.Server()`, `node:https`, a worker-hosted render server) the hook
 * becomes a no-op and the 500s return with nothing to announce it. The startup
 * self-check below exists solely to make that loud — alert on the marker string.
 *
 * Delete this file and restore `ENTRYPOINT ["node", "server.js"]` once upstream
 * fixes the 405 render path, or once static assets are served off an
 * `assetPrefix` CDN and never reach this process at all.
 */
const http = require('node:http');

const BODY = 'Method Not Allowed';
const BODY_LENGTH = Buffer.byteLength(BODY);
const INSTALL_CHECK_DELAY_MS = 10_000;

const originalCreateServer = http.createServer;
let guardInstalled = false;

http.createServer = function createServerWithStatusRepair(...args) {
  const handlerIndex = args.findIndex((arg) => typeof arg === 'function');

  if (handlerIndex !== -1) {
    const originalHandler = args[handlerIndex];
    guardInstalled = true;

    args[handlerIndex] = function repairingHandler(req, res) {
      const originalWriteHead = res.writeHead;
      const originalEnd = res.end;
      let repairing = false;

      // A 500 that already carries `Allow` can only be the botched-405 path.
      const isBotched405 = (status) => status === 500 && Boolean(res.getHeader('Allow'));

      const applyRepair = () => {
        repairing = true;
        res.removeHeader('ETag');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Length', String(BODY_LENGTH));
      };

      // Next reaches this via an explicit writeHead(500), so headers are already
      // sent by the time end() runs — the status has to be corrected here.
      res.writeHead = function patchedWriteHead(...headArgs) {
        if (!repairing && isBotched405(headArgs[0])) {
          headArgs[0] = 405;
          applyRepair();
        }
        return originalWriteHead.apply(this, headArgs);
      };

      // Fallback for an implicit header flush, should Next ever stop using writeHead.
      res.end = function patchedEnd(...endArgs) {
        if (!repairing && !res.headersSent && isBotched405(res.statusCode)) {
          res.statusCode = 405;
          applyRepair();
        }
        if (repairing) {
          const callback = endArgs.find((arg) => typeof arg === 'function');
          return callback ? originalEnd.call(this, BODY, callback) : originalEnd.call(this, BODY);
        }
        return originalEnd.apply(this, endArgs);
      };

      return originalHandler.call(this, req, res);
    };
  }

  return originalCreateServer.apply(this, args);
};

// If Next stopped routing through http.createServer, say so instead of silently
// reverting to 500s. Unref'd so it never holds the process open.
setTimeout(() => {
  if (!guardInstalled) {
    console.error(
      'server-entry: status-repair NOT installed — http.createServer was never called with a handler. ' +
        'Next likely changed how it builds its listener; non-GET on existing static files is emitting 500 again. ' +
        'See scripts/server-entry.js.',
    );
  }
}, INSTALL_CHECK_DELAY_MS).unref();

require('./server.js');
