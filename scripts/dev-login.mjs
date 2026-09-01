#!/usr/bin/env node

/**
 * Captures a dev session for `scripts/dev-proxy.mjs`.
 *
 * ## The problem it solves
 *
 * A deployed OpenFrame authenticates by HttpOnly cookie on the gateway's domain
 * (confirmed by a real deployment's `__ENV`: no `NEXT_PUBLIC_TENANT_HOST_URL`, no
 * dev-ticket flag). HttpOnly is the point of HttpOnly — `document.cookie` cannot
 * read it, so there is no in-page way to lift a session, and the OAuth flow
 * itself ends at an SSO provider no script should be driving.
 *
 * The Chrome DevTools Protocol can read it, because it is the browser talking
 * about itself rather than a page reaching into another origin. So: open a real
 * Chrome, let a human log in exactly as they would anyway, then ask the browser
 * for the cookies it now holds.
 *
 * ## Why not a local callback listener
 *
 * The obvious design — spin up `http://localhost:PORT/callback`, pass it as
 * `redirectTo`, catch the `devTicket` the gateway appends, exchange it at
 * `/oauth/dev-exchange` for a bearer pair — does not work, and fails in a way
 * worth recording so it is not re-attempted:
 *
 *   GET /oauth/login?tenantId=…&authMobile=true&redirectTo=http%3A%2F%2Flocalhost%3A7788%2Fcallback
 *   → HTTP 502
 *
 * The same request without `redirectTo` 302s to the authz server normally. This
 * matches what `src/lib/native-login.ts` documents from the other side: the
 * app's custom scheme is "the only redirect target the gateway honours verbatim
 * in every environment" — an https redirect is rewritten to the tenant root, and
 * a localhost one is not survivable at all. Capturing the browser's own cookies
 * needs nothing from the gateway, which is why it is the approach here.
 *
 * ## Why a dedicated profile
 *
 * Chrome ignores `--remote-debugging-port` on a profile that is already running,
 * and attaching to someone's everyday browser would expose every cookie in it to
 * this script. `.dev-chrome/` is a separate profile that holds one login to one
 * QA tenant and nothing else. It persists, so this is a rare command, not a daily
 * one — and it doubles as the profile browser-automation tooling can drive.
 *
 * ## What it does NOT do
 *
 * It never types a password and never touches the SSO provider. The human logs
 * in; this waits for `/api/me` to answer `authenticated: true` through the
 * cookies the browser ended up with, and only then writes the file.
 *
 *   npm run dev:login
 *   npm run dev:login -- --tenant-host https://test-env.qa.openframe.build
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SESSION_FILE = resolve(projectRoot, '.dev-session.json');
const PROFILE_DIR = resolve(projectRoot, '.dev-chrome');

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
};

const tenantHost = (flag('tenant-host') || process.env.OPENFRAME_DEV_TENANT_HOST || '').replace(/\/+$/, '');
const cdpPort = Number(flag('cdp-port') || 9222);
const timeoutMs = Number(flag('timeout') || 300_000);

if (!tenantHost) {
  console.error(
    'Usage: npm run dev:login -- --tenant-host https://<tenant>.qa.openframe.build\n' +
      '   or: OPENFRAME_DEV_TENANT_HOST=https://... npm run dev:login',
  );
  process.exit(1);
}

/**
 * The shared auth host, defaulted from the tenant host by dropping one label:
 * `test-env.qa.openframe.build` → `qa.openframe.build`, which is the pairing a
 * real deployment's `__ENV` shows (`NEXT_PUBLIC_SHARED_HOST_URL`). Overridable,
 * because nothing guarantees that shape forever.
 */
function defaultSharedHost(tenant) {
  const url = new URL(tenant);
  const labels = url.hostname.split('.');
  return labels.length > 3 ? `${url.protocol}//${labels.slice(1).join('.')}` : tenant;
}
const sharedHost = (flag('shared-host') || defaultSharedHost(tenantHost)).replace(/\/+$/, '');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  const explicit = flag('chrome') || process.env.CHROME_PATH;
  if (explicit) return explicit;
  const found = CHROME_CANDIDATES.find(p => existsSync(p));
  if (!found) {
    console.error('Could not find Chrome. Pass --chrome /path/to/chrome or set CHROME_PATH.');
    process.exit(1);
  }
  return found;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForCdp(port, deadline) {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting — the connection refusal IS the "not yet".
    }
    await sleep(250);
  }
  throw new Error('Chrome did not expose its debugging port in time');
}

/**
 * One CDP command over the browser-level socket.
 *
 * `Storage.getCookies` with no `browserContextId` returns the whole jar,
 * HttpOnly included. That is the single capability this script exists for, and
 * it is only available to the browser endpoint — a page-level `document.cookie`
 * would silently return the non-HttpOnly subset, i.e. everything except the
 * session.
 */
function cdpSend(ws, method, params = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const id = (cdpSend.nextId = (cdpSend.nextId || 0) + 1);
    const onMessage = event => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) rejectPromise(new Error(`${method}: ${msg.error.message}`));
      else resolvePromise(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function openSocket(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolvePromise(ws), { once: true });
    ws.addEventListener('error', () => rejectPromise(new Error('CDP socket failed')), { once: true });
  });
}

function relevantCookies(all) {
  const hosts = [new URL(tenantHost).hostname, new URL(sharedHost).hostname];
  return all
    .filter(c => hosts.some(h => h === c.domain.replace(/^\./, '') || h.endsWith(`.${c.domain.replace(/^\./, '')}`)))
    .map(({ name, value, domain, path, expires, secure, httpOnly }) => ({
      name,
      value,
      domain: domain.replace(/^\./, ''),
      path: path || '/',
      expires: expires ?? -1,
      secure,
      httpOnly,
    }));
}

/**
 * The only definition of "logged in" this script trusts: the gateway saying so.
 *
 * A cookie count would be the tempting check and the wrong one — the login page
 * itself sets cookies, so a jar can look convincingly full while the session
 * behind it does not exist. `/api/me` is also exactly the call the app makes
 * first, so a pass here means the app will get past its auth gate.
 */
async function verify(cookies) {
  const host = new URL(tenantHost).hostname;
  const header = cookies
    .filter(c => host === c.domain || host.endsWith(`.${c.domain}`))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
  if (!header) return false;
  try {
    const res = await fetch(`${tenantHost}/api/me`, {
      headers: { cookie: header, accept: 'application/json' },
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return Boolean(body?.authenticated);
  } catch {
    return false;
  }
}

async function main() {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const chrome = findChrome();

  console.log(`\n  Opening ${tenantHost} in a dedicated Chrome profile.`);
  console.log('  Log in as you normally would — this waits, then captures the session.\n');

  const child = spawn(
    chrome,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      tenantHost,
    ],
    { stdio: 'ignore', detached: false },
  );
  child.on('error', err => {
    console.error(`Failed to launch Chrome: ${err.message}`);
    process.exit(1);
  });

  const deadline = Date.now() + timeoutMs;
  const wsUrl = await waitForCdp(cdpPort, deadline);
  const ws = await openSocket(wsUrl);

  let captured = null;
  while (Date.now() < deadline) {
    const { cookies } = await cdpSend(ws, 'Storage.getCookies');
    const relevant = relevantCookies(cookies);
    if (relevant.length && (await verify(relevant))) {
      captured = relevant;
      break;
    }
    await sleep(2000);
  }

  ws.close();

  if (!captured) {
    console.error('\n  Timed out waiting for a signed-in session. Nothing written.');
    child.kill();
    process.exit(1);
  }

  writeFileSync(
    SESSION_FILE,
    `${JSON.stringify({ tenantHost, sharedHost, capturedAt: new Date().toISOString(), cookies: captured }, null, 2)}\n`,
    // The file is a live credential. 0600 is not security theatre here: the
    // repo directory is readable by anything else the machine runs.
    { mode: 0o600 },
  );

  console.log(`  Captured ${captured.length} cookie(s) → .dev-session.json`);
  console.log('  You can close that Chrome window. Run "npm run dev:proxy".\n');
  child.kill();
}

main().catch(err => {
  console.error(`\n  ${err.message}\n`);
  process.exit(1);
});
