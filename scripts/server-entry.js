/**
 * Standalone-server entrypoint. Wraps Next's generated `server.js`.
 *
 * Next 16 answers non-GET/HEAD for an *existing* static file (`/_next/static/`
 * or `public/`) with 500 instead of 405: it sets `Allow: GET, HEAD` + 405, then
 * renders `/405` through a Pages-Router-only lookup that an App-Router build
 * cannot satisfy, and its own catch downgrades the result to 500. Silent — the
 * wrapped build error skips `logError`.
 *
 * Keyed on the response, not the URL: only two places in Next set `Allow`, and
 * both set 405 immediately, so a 500 carrying `Allow` is unambiguously this bug.
 * That covers both static roots and leaves 404s for missing files intact.
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
  const handlerIndex = args.findIndex((arg) => typeof arg === 'function');

  if (handlerIndex !== -1) {
    const originalHandler = args[handlerIndex];
    guardInstalled = true;

    args[handlerIndex] = function repairingHandler(req, res) {
      const originalWriteHead = res.writeHead;
      const originalEnd = res.end;
      let repairing = false;

      const isBotched405 = (status) => status === 500 && Boolean(res.getHeader('Allow'));

      const applyRepair = () => {
        repairing = true;
        res.removeHeader('ETag'); // was computed for the asset, not for this body
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Length', String(BODY_LENGTH));
      };

      // Must hook writeHead: Next calls writeHead(500) explicitly, so by the
      // time end() runs the headers are already sent.
      res.writeHead = function patchedWriteHead(...headArgs) {
        if (!repairing && isBotched405(headArgs[0])) {
          headArgs[0] = 405;
          applyRepair();
        }
        return originalWriteHead.apply(this, headArgs);
      };

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
