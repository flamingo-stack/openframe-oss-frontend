/**
 * Standalone-server entrypoint. Wraps Next's generated `server.js`.
 *
 * Next 16 answers non-GET/HEAD for an *existing* static file (`/_next/static/`
 * or `public/`) with 500 instead of 405: it sets `Allow: GET, HEAD` + 405, then
 * renders `/405` through a Pages-Router-only lookup that an App-Router build
 * cannot satisfy, and its own catch downgrades the result to 500. Silent — the
 * wrapped build error skips `logError`.
 *
 * Keyed on the response, not the URL: only two places in Next set `Allow`
 * server-side (`base-server.js`, `router-server.js`) and both set 405 in the
 * same breath, so a 500 carrying `Allow` is unambiguously this bug. (App-route
 * `auto-implement-methods.js` also emits `Allow`, but on a 204 OPTIONS
 * response, so it cannot collide either.) That covers both static roots and
 * leaves 404s for missing files intact.
 *
 * Rejected alternatives, all tested — do not retry them:
 * - `src/app/405/page.tsx` — the status-page lookup passes `isAppPath: false`,
 *   so the App Router is invisible to it.
 * - `src/pages/405.tsx` — works at runtime, but a `pages/` directory flips
 *   `next/navigation`'s `useSearchParams()` to `... | null` and breaks
 *   type-check in 67 files.
 * - Widening the `src/proxy.ts` matcher over static paths — roughly doubles
 *   static-asset latency and puts every JS chunk behind `isAllowed()`.
 * - Injecting `/405` into `pages-manifest.json` — no effect, different path.
 * - Upgrading Next — reproduced unchanged on 16.2.12 and 16.3.0.
 *
 * Delete this file and restore `ENTRYPOINT ["node", "server.js"]` once upstream
 * fixes the 405 render path. Unfixed as of 16.3.0.
 */
const http = require('node:http');

const BODY = 'Method Not Allowed';
const BODY_LENGTH = Buffer.byteLength(BODY);
const INSTALL_CHECK_DELAY_MS = 10_000;

const originalCreateServer = http.createServer;
let guardInstalled = false;

http.createServer = function createServerWithStatusRepair(...args) {
  const handlerIndex = args.findIndex(arg => typeof arg === 'function');

  if (handlerIndex !== -1) {
    const originalHandler = args[handlerIndex];
    guardInstalled = true;

    args[handlerIndex] = function repairingHandler(req, res) {
      const originalWriteHead = res.writeHead;
      const originalWrite = res.write;
      const originalEnd = res.end;
      let repairing = false;
      let bodySent = false;

      const isBotched405 = status => status === 500 && Boolean(res.getHeader('Allow'));

      const applyRepair = () => {
        repairing = true;
        // All three described the asset, not this body.
        res.removeHeader('ETag');
        res.removeHeader('Transfer-Encoding'); // would conflict with Content-Length
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Length', String(BODY_LENGTH));
      };

      // Must hook writeHead: Next calls writeHead(500) explicitly, so by the
      // time end() runs the headers are already sent.
      res.writeHead = function patchedWriteHead(...headArgs) {
        if (repairing || isBotched405(headArgs[0])) {
          applyRepair();
          // Status only — no forwarded arguments. A headers argument takes
          // precedence over applyRepair's setHeader calls, so passing it on
          // would re-attach the asset's Content-Length/ETag to an 18-byte body,
          // and the 500's reason phrase would read "405 Internal Server Error".
          // `repairing` is in the condition, not `!repairing`: a repair started
          // from write() has not flushed headers, so a later writeHead() must
          // stay repaired rather than fall through and re-open the response.
          return originalWriteHead.call(this, 405);
        }
        return originalWriteHead.apply(this, headArgs);
      };

      // Everything the original response would have written is discarded: only
      // BODY may reach the wire, or the bytes sent stop matching Content-Length
      // and the surplus is parsed as the head of the next keep-alive response.
      // The check has to run here rather than lean on writeHead: a first write()
      // flushes the headers implicitly, so by the time writeHead repairs, this
      // chunk is already going out.
      res.write = function patchedWrite(...writeArgs) {
        if (!repairing && !res.headersSent && isBotched405(res.statusCode)) {
          res.statusCode = 405;
          applyRepair();
        }
        if (!repairing) {
          return originalWrite.apply(this, writeArgs);
        }
        const callback = writeArgs.find(arg => typeof arg === 'function');
        if (callback) process.nextTick(callback);
        return true;
      };

      res.end = function patchedEnd(...endArgs) {
        if (!repairing && !res.headersSent && isBotched405(res.statusCode)) {
          res.statusCode = 405;
          applyRepair();
        }
        if (repairing) {
          const callback = endArgs.find(arg => typeof arg === 'function');
          // BODY goes out once. A second end() must stay the no-op it is
          // without this wrapper — passing a chunk after the stream finished
          // emits ERR_STREAM_WRITE_AFTER_END on the response, which nothing
          // listens for and which takes the process down.
          if (bodySent) {
            return callback ? originalEnd.call(this, callback) : originalEnd.call(this);
          }
          bodySent = true;
          return callback ? originalEnd.call(this, BODY, callback) : originalEnd.call(this, BODY);
        }
        return originalEnd.apply(this, endArgs);
      };

      return originalHandler.call(this, req, res);
    };
  }

  return originalCreateServer.apply(this, args);
};

// If a future Next stops building its listener via http.createServer this hook
// silently no-ops and the 500s return. Alert on this string.
setTimeout(() => {
  if (!guardInstalled) {
    console.error(
      'server-entry: status-repair NOT installed — http.createServer was never called with a handler. ' +
        'Non-GET on existing static files is emitting 500 again. See scripts/server-entry.js.',
    );
  }
}, INSTALL_CHECK_DELAY_MS).unref();

require('./server.js');
