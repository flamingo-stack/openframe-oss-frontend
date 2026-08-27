#!/usr/bin/env node

/**
 * Local credential-injecting reverse proxy for `next dev`.
 *
 * ## Why this exists
 *
 * The deployed app is a SAME-ORIGIN app. `__ENV` on a real deployment carries no
 * `NEXT_PUBLIC_TENANT_HOST_URL`, and all three URL builders fall back to a
 * relative path when the host is empty (`api-client.ts` `buildUrl`,
 * `relay/environment.ts` `getGraphqlUrl`, `auth-api-client.ts` `buildAuthUrl`):
 * the browser only ever talks to its own origin and a reverse proxy in front
 * fans the paths out to the gateway. `next.config.mjs` already encodes a
 * one-path version of exactly this for `/content/*`.
 *
 * Local dev was the only configuration that pointed the browser at a DIFFERENT
 * origin — and then needed the backend to grow CORS for a shape production never
 * has. This process is the missing reverse proxy, so dev matches the deployment
 * instead of asking the backend to accommodate it.
 *
 * ## What it adds beyond path routing
 *
 * The session cookie belongs to the upstream domain and can never be set on
 * `localhost`, so proxying alone would leave every request signed out. This
 * process holds the cookie jar SERVER-SIDE: it attaches the stored cookies going
 * up, swallows `Set-Cookie` coming down, and persists rotations back to
 * `.dev-session.json`.
 *
 * Two consequences worth naming, because they are the whole point:
 *
 * - **The browser never holds a credential.** A fresh, cookie-less profile —
 *   which is what any browser-automation tool drives — is fully signed in the
 *   moment it opens `localhost:3000`. No storage seeding, no OAuth dance per run.
 * - **Expiry stops being a session-length limit.** Nothing here refreshes
 *   anything on a timer; the APP's own 401 → `/oauth/refresh` path does, exactly
 *   as it does in production, and the rotated cookies land in the jar on the way
 *   back. The proxy only has to not lose them.
 *
 * ## Usage
 *
 *   npm run dev:login     # once — capture a session (scripts/dev-login.mjs)
 *   npm run dev:proxy     # starts this alongside `next dev` (scripts/dev.mjs)
 *
 * `npm run dev` is untouched and still runs a bare dev server with no gateway
 * access — this is opt-in, not a new default.
 *
 * Flags: `--port`, `--session`, `--quiet`. Env: `OPENFRAME_DEV_PROXY_PORT`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
};

export const SESSION_FILE = resolve(projectRoot, '.dev-session.json');
const sessionPath = flag('session') ? resolve(flag('session')) : SESSION_FILE;
const PORT = Number(flag('port') || process.env.OPENFRAME_DEV_PROXY_PORT || 7787);
const quiet = args.includes('--quiet');

/**
 * Path → upstream. Two upstreams, not one, and the split is not arbitrary: the
 * deployed app already makes this exact distinction. `/api`, `/tools`, `/content`
 * are same-origin on the tenant host; `/oauth` and `/sas` go to
 * `NEXT_PUBLIC_SHARED_HOST_URL` — a DIFFERENT host even in QA (`qa.openframe.build`
 * vs `test-env.qa.openframe.build`).
 *
 * Locally both are proxied, which is why `.env.local` must leave BOTH host vars
 * empty: a set `SHARED_HOST_URL` would send auth calls straight to the shared
 * host from `localhost`, and that is the one origin its CORS policy does not
 * list.
 */
const ROUTES = [
  { prefix: '/oauth/', upstream: 'shared' },
  { prefix: '/sas/', upstream: 'shared' },
  { prefix: '/api/', upstream: 'tenant' },
  // saas-ai-agent (tickets + Mingo). Easy to forget, because nothing on a
  // scripts page mentions chat — but the APP LAYOUT mounts it in saas-tenant
  // mode, so leaving it out does not merely disable chat: the call falls through
  // to `next dev`, comes back as 32 KB of 404 HTML where JSON was expected, and
  // retries forever inside a layout-level boundary. Every page then sits in its
  // skeleton with a perfectly healthy session behind it.
  { prefix: '/chat/', upstream: 'tenant' },
  { prefix: '/tools/', upstream: 'tenant' },
  { prefix: '/content/', upstream: 'tenant' },
];

/** Hop-by-hop headers: meaningful to ONE connection, never to be relayed (RFC 9110 §7.6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const log = (...parts) => {
  if (!quiet) console.log('[dev-proxy]', ...parts);
};

// ---------------------------------------------------------------------------
// Session file
// ---------------------------------------------------------------------------

function loadSession() {
  let raw;
  try {
    raw = readFileSync(sessionPath, 'utf-8');
  } catch {
    console.error(
      `[dev-proxy] No session at ${sessionPath}.\n` + `[dev-proxy] Run "npm run dev:login" first — it captures one.`,
    );
    process.exit(1);
  }
  const session = JSON.parse(raw);
  if (!session.tenantHost) {
    console.error('[dev-proxy] Session file has no tenantHost. Re-run "npm run dev:login".');
    process.exit(1);
  }
  session.sharedHost ||= session.tenantHost;
  session.cookies ||= [];
  return session;
}

const session = loadSession();

/**
 * Refuse to carry a live production session by default.
 *
 * This process turns "whatever is in a file on disk" into an authenticated
 * request against a real backend, and it is driven by tooling that clicks
 * things. Pointing it at production is a mistake worth making loud rather than
 * discoverable; a marker in the hostname is a crude test, but it fails CLOSED,
 * which is the direction that matters.
 */
function assertNonProdUpstream(url) {
  if (process.env.OPENFRAME_DEV_PROXY_ALLOW_PROD === '1') return;
  const { hostname } = new URL(url);
  const looksSafe =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /(^|[.-])(qa|dev|test|stage|staging|local)([.-]|$)/.test(hostname);
  if (!looksSafe) {
    console.error(
      `[dev-proxy] Refusing to proxy to "${hostname}" — it does not look like a dev/QA host.\n` +
        `[dev-proxy] Set OPENFRAME_DEV_PROXY_ALLOW_PROD=1 if this really is intended.`,
    );
    process.exit(1);
  }
}

assertNonProdUpstream(session.tenantHost);
assertNonProdUpstream(session.sharedHost);

const UPSTREAM = {
  tenant: new URL(session.tenantHost),
  shared: new URL(session.sharedHost),
};

// ---------------------------------------------------------------------------
// Cookie jar
// ---------------------------------------------------------------------------

/**
 * Keyed the way RFC 6265 identifies a cookie: name + domain + path, not name
 * alone. The separator is NUL because none of the three parts can contain one,
 * so no two distinct cookies can collide on a joined key — and it is written as
 * an escape rather than a literal byte, which would make git treat this whole
 * file as binary and hand reviewers `Bin 0 -> 16286 bytes` instead of a diff.
 */
const jarKey = c => `${c.name}\u0000${c.domain}\u0000${c.path || '/'}`;
const jar = new Map(session.cookies.map(c => [jarKey(c), c]));

let persistTimer = null;
/**
 * Rotations are written back so the session survives a restart of this process —
 * a refresh-token rotation that only lived in memory would leave the file holding
 * a credential the gateway has already invalidated, i.e. a session that dies at
 * the next `npm run dev` for no visible reason.
 *
 * Debounced because a single page load can rotate once and then fan out twenty
 * requests behind it.
 */
function persistJar() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const next = { ...session, cookies: [...jar.values()], updatedAt: new Date().toISOString() };
    writeFileSync(sessionPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  }, 250);
  persistTimer.unref?.();
}

function domainMatches(cookieDomain, host) {
  const d = cookieDomain.replace(/^\./, '');
  return host === d || host.endsWith(`.${d}`);
}

function cookieHeaderFor(host, path) {
  const now = Date.now() / 1000;
  const matched = [...jar.values()].filter(c => {
    if (!domainMatches(c.domain, host)) return false;
    if (c.path && c.path !== '/' && !path.startsWith(c.path)) return false;
    // `expires: -1` is CDP's encoding for a session cookie — no expiry, keep it.
    if (typeof c.expires === 'number' && c.expires > 0 && c.expires < now) return false;
    return true;
  });
  // Longest path first (RFC 6265 §5.4). This gateway sets some cookies twice —
  // once with `Domain=.openframe.build` and once host-only — so one name can
  // legitimately appear twice in the header, exactly as a browser would send it.
  // The order is what lets the server pick the more specific one.
  matched.sort((a, b) => (b.path || '/').length - (a.path || '/').length);
  return matched.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * Absorbs a `Set-Cookie` from an upstream response instead of relaying it.
 *
 * Relaying would put the credential in the browser under the WRONG domain
 * (`localhost`), where it would be sent back to us on every request and give the
 * jar a second, diverging source of truth — and would undo the one property this
 * whole design is for: that a browser profile driven by tooling holds nothing.
 */
function absorbSetCookie(rawList, defaultDomain) {
  for (const raw of rawList) {
    const [pair, ...attrs] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const cookie = {
      name: pair.slice(0, eq).trim(),
      value: pair.slice(eq + 1).trim(),
      domain: defaultDomain,
      path: '/',
      expires: -1,
    };
    let maxAge;
    for (const attr of attrs) {
      const idx = attr.indexOf('=');
      const key = (idx === -1 ? attr : attr.slice(0, idx)).trim().toLowerCase();
      const val = idx === -1 ? '' : attr.slice(idx + 1).trim();
      if (key === 'domain' && val) cookie.domain = val.replace(/^\./, '');
      else if (key === 'path' && val) cookie.path = val;
      else if (key === 'max-age') maxAge = Number(val);
      else if (key === 'expires') cookie.expires = Date.parse(val) / 1000;
    }
    // Max-Age wins over Expires when both are present (RFC 6265 §5.3), and
    // `Max-Age<=0` is not "expires about now" — it is the DELETE instruction,
    // stated unconditionally (§5.2.2). Deciding it by comparing a computed
    // expiry against `Date.now()` a few statements later is a sub-millisecond
    // race, and this gateway makes it a live one: it clears its session cookies
    // with `Max-Age=0; Expires=Thu, 01 Jan 1970`, so a lost race stores an
    // EMPTY cookie under the name of a real one — which then rides along on
    // every request and can shadow the session it was supposed to remove.
    if (maxAge !== undefined && Number.isFinite(maxAge)) {
      if (maxAge <= 0) {
        jar.delete(jarKey(cookie));
        continue;
      }
      cookie.expires = Date.now() / 1000 + maxAge;
    }
    if (typeof cookie.expires === 'number' && cookie.expires > 0 && cookie.expires * 1000 <= Date.now()) {
      jar.delete(jarKey(cookie));
      continue;
    }
    jar.set(jarKey(cookie), cookie);
  }
  persistJar();
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

function pickUpstream(pathname) {
  const route = ROUTES.find(r => pathname.startsWith(r.prefix));
  return route ? UPSTREAM[route.upstream] : null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const upstream = pickUpstream(url.pathname);

  if (!upstream) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`dev-proxy: no upstream for ${url.pathname}\n`);
    return;
  }

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key) || key === 'cookie' || key === 'host' || key === 'content-length') continue;
    // Drop the dev chain's forwarding trail. `next dev` stamps
    // `x-forwarded-host: localhost:3000` on everything it rewrites, and the authz
    // server BUILDS THE TOKEN'S `iss` CLAIM from it: a refresh performed through
    // this proxy came back minting `iss: https://localhost:3000/sas/<tenant>`
    // instead of the real issuer. The gateway then 500s on every request made
    // with that token — a session that dies at the first rotation, ~15 minutes
    // in, for no reason visible from the browser.
    //
    // Nothing downstream wants these: the upstream is being addressed directly,
    // so it should derive host and scheme from the request line and its own
    // config, exactly as it does for a request off the public internet.
    if (key.startsWith('x-forwarded-') || key === 'forwarded' || key === 'x-real-ip') continue;
    headers[key] = value;
  }

  // The gateway sees a first-party request, because that is what it is once the
  // browser's own origin is an implementation detail of the dev setup. Leaving
  // `localhost:3000` here invites an Origin/CSRF rejection that would look like
  // a broken endpoint rather than a proxy misconfiguration.
  headers.host = upstream.host;
  headers.origin = upstream.origin;
  if (req.headers.referer) {
    headers.referer = req.headers.referer.replace(/^https?:\/\/[^/]+/, upstream.origin);
  }

  const cookie = cookieHeaderFor(upstream.hostname, url.pathname);
  if (cookie) headers.cookie = cookie;

  const doRequest = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const proxied = doRequest(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers,
    },
    upstreamRes => {
      const setCookie = upstreamRes.headers['set-cookie'];
      if (setCookie?.length) absorbSetCookie(setCookie, upstream.hostname);

      const out = {};
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (HOP_BY_HOP.has(key) || key === 'set-cookie' || key === 'content-length') continue;
        out[key] = value;
      }
      if (upstreamRes.statusCode >= 400) {
        log(`${upstreamRes.statusCode} ${req.method} ${url.pathname}`);
      }
      res.writeHead(upstreamRes.statusCode, out);
      // Piped, never buffered: `/content` chat responses stream, and buffering
      // would turn a token-by-token reply into one silent wait.
      upstreamRes.pipe(res);
    },
  );

  proxied.on('error', err => {
    console.error(`[dev-proxy] upstream error on ${url.pathname}:`, err.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`dev-proxy: upstream error: ${err.message}\n`);
  });

  req.pipe(proxied);
});

/**
 * WebSocket upgrades are NOT handled. They would have to be, to make NATS live
 * updates work locally — but the browser opens that socket against
 * `window.location.origin`, i.e. the Next dev server, and `rewrites()` do not
 * proxy upgrades, so nothing would reach this process anyway. Answering the
 * upgrade with a clean refusal beats leaving the socket hanging until it times
 * out: the client retries on close, and a retry loop is at least legible.
 */
server.on('upgrade', (_req, socket) => {
  socket.end('HTTP/1.1 501 Not Implemented\r\n\r\n');
});

// A port left occupied by a previous run is the most likely way to meet this
// script, and an unhandled 'error' event would greet it with a raw stack trace
// about `net:2016`. Name the actual problem instead.
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[dev-proxy] Port ${PORT} is already in use — most likely a dev-proxy from an earlier run.\n` +
        `[dev-proxy] Stop it (lsof -ti:${PORT} | xargs kill) or pick another with OPENFRAME_DEV_PROXY_PORT.`,
    );
  } else {
    console.error(`[dev-proxy] ${err.message}`);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on http://127.0.0.1:${PORT}`);
  log(`tenant → ${UPSTREAM.tenant.origin}`);
  log(`shared → ${UPSTREAM.shared.origin}`);
  log(`jar    → ${jar.size} cookie(s) from ${sessionPath}`);
});
