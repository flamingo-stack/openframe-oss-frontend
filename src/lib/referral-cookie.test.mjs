// Framework-free tests for the partner-referral cookie (`?ref=` → `of_ref`).
//
// Run with `node --test src/lib/referral-cookie.test.mjs`, or `npm test`.
//
// The mock below is a small cookie jar rather than a string, because the thing most worth
// proving here is not "a cookie was written" but "the cookie written on openframe.ai is
// readable on auth.openframe.ai" — which is a question about the `Domain` attribute, and is
// invisible to a mock that stores only `name=value`.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import './test-module-resolve.mjs';

/** @type {{name: string, value: string, domain: string | undefined, attrs: Record<string, string>}[]} */
let jar = [];
let writes = 0;

/** Browser rule: a `Domain=` cookie is sent to that domain and every subdomain; otherwise host-only. */
function visibleTo(hostname) {
  return jar
    .filter(c =>
      c.domain ? hostname === c.domain.replace(/^\./, '') || hostname.endsWith(c.domain) : hostname === c.host,
    )
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

function browseTo(url) {
  const parsed = new URL(url);
  globalThis.window = {
    location: { hostname: parsed.hostname, protocol: parsed.protocol, search: parsed.search },
  };
  globalThis.document = {
    get cookie() {
      return visibleTo(parsed.hostname);
    },
    set cookie(raw) {
      writes += 1;
      const [pair, ...rest] = raw.split('; ');
      const [name, value] = pair.split('=');
      const attrs = Object.fromEntries(
        rest.map(part => {
          const [k, v = ''] = part.split('=');
          return [k.toLowerCase(), v];
        }),
      );
      jar = jar.filter(c => c.name !== name);
      jar.push({ name, value, domain: attrs.domain, host: parsed.hostname, attrs });
    },
  };
}

function storedCookie(name = 'of_ref') {
  return jar.find(c => c.name === name);
}

beforeEach(() => {
  jar = [];
  writes = 0;
  browseTo('https://openframe.ai/');
});

const R = await import('./referral-cookie.ts');

test('sanitize accepts a partner code and trims it', () => {
  assert.equal(R.sanitizeReferralCode('  partner-123  '), 'partner-123');
  assert.equal(R.sanitizeReferralCode('acme_co.2026'), 'acme_co.2026');
});

// A code reaches a Set-Cookie header and then the registration payload, so anything that could
// terminate the cookie or smuggle an attribute is dropped whole rather than escaped.
test('sanitize rejects blanks, over-long codes and cookie-breaking characters', () => {
  for (const bad of [
    null,
    undefined,
    '',
    '   ',
    'a'.repeat(65),
    'evil; Domain=attacker.com',
    'a,b',
    'a b',
    'a"b',
    '<x>',
  ]) {
    assert.equal(R.sanitizeReferralCode(bad), undefined, `must reject ${JSON.stringify(bad)}`);
  }
  assert.equal(R.sanitizeReferralCode('a'.repeat(64)), 'a'.repeat(64), 'the limit itself is allowed');
});

// The whole point of the cookie: the marketing site and the signup app are different hosts.
test('the cookie domain is the shared registrable base for every openframe.ai host', () => {
  assert.equal(R.resolveReferralCookieDomain('openframe.ai'), '.openframe.ai');
  assert.equal(R.resolveReferralCookieDomain('www.openframe.ai'), '.openframe.ai');
  assert.equal(R.resolveReferralCookieDomain('auth.openframe.ai'), '.openframe.ai');
  assert.equal(R.resolveReferralCookieDomain('hub.openframe.ai'), '.openframe.ai');
});

test('hosts a browser refuses a Domain on get a host-only cookie', () => {
  for (const host of ['localhost', '127.0.0.1', '192.168.1.10', 'preview-abc.vercel.app']) {
    assert.equal(R.resolveReferralCookieDomain(host), undefined, `${host} must stay host-only`);
  }
});

test('a captured referral carries the 90-day window and its cross-subdomain scope', () => {
  browseTo('https://openframe.ai/pricing?ref=partner-123');
  R.captureReferralFromUrl();

  const cookie = storedCookie();
  assert.equal(cookie.value, 'partner-123');
  assert.equal(cookie.attrs.domain, '.openframe.ai');
  assert.equal(cookie.attrs['max-age'], String(90 * 24 * 60 * 60));
  assert.equal(cookie.attrs.path, '/');
  assert.equal(cookie.attrs.samesite, 'Lax');
  assert.ok('secure' in cookie.attrs, 'an https visit must set Secure');
});

// Requirement 3 of the task: the hop from the marketing site to the signup app.
test('a referral clicked on the marketing site is readable on the signup subdomain', () => {
  browseTo('https://openframe.ai/?ref=partner-123');
  R.captureReferralFromUrl();

  browseTo('https://auth.openframe.ai/auth');
  assert.equal(R.readReferralCode(), 'partner-123');
});

// The behaviour the task calls out explicitly: one referred visit is enough, and later
// unreferred visits — from any source, on any subdomain — must not lose it.
test('a later visit without ?ref= keeps the stored referral', () => {
  browseTo('https://openframe.ai/?ref=partner-123');
  R.captureReferralFromUrl();

  browseTo('https://openframe.ai/blog/some-post');
  R.captureReferralFromUrl();
  assert.equal(R.readReferralCode(), 'partner-123');

  browseTo('https://auth.openframe.ai/auth?utm_source=newsletter');
  R.captureReferralFromUrl();
  assert.equal(R.readReferralCode(), 'partner-123');
});

test('last touch wins: a new referral replaces the stored one and restarts the window', () => {
  browseTo('https://openframe.ai/?ref=partner-123');
  R.captureReferralFromUrl();

  browseTo('https://openframe.ai/?ref=partner-456');
  R.captureReferralFromUrl();

  assert.equal(R.readReferralCode(), 'partner-456');
  assert.equal(jar.filter(c => c.name === 'of_ref').length, 1, 'one cookie, replaced — not two');
  assert.equal(storedCookie().attrs['max-age'], String(90 * 24 * 60 * 60));
});

// Rewriting a server-set cookie from JavaScript is what re-arms Safari's 7-day ITP cap on it,
// so an unchanged value must not be touched at all.
test('re-landing on the same referral does not rewrite the cookie', () => {
  browseTo('https://openframe.ai/?ref=partner-123');
  R.captureReferralFromUrl();
  const writesAfterFirst = writes;

  browseTo('https://openframe.ai/other?ref=partner-123');
  R.captureReferralFromUrl();

  assert.equal(writes, writesAfterFirst, 'the second landing must be a no-op');
});

test('an unusable ?ref= is ignored and leaves an existing referral intact', () => {
  browseTo('https://openframe.ai/?ref=partner-123');
  R.captureReferralFromUrl();

  browseTo('https://openframe.ai/?ref=' + encodeURIComponent('evil; Domain=attacker.com'));
  R.captureReferralFromUrl();

  assert.equal(R.readReferralCode(), 'partner-123');
  assert.equal(jar.length, 1);
});

test('a hand-edited cookie value is re-validated on read', () => {
  jar.push({ name: 'of_ref', value: 'evil value', domain: '.openframe.ai', host: 'openframe.ai', attrs: {} });
  assert.equal(R.readReferralCode(), undefined);
});

test('an http visit omits Secure so the cookie is usable in local development', () => {
  browseTo('http://localhost:3000/?ref=partner-123');
  R.captureReferralFromUrl();

  const cookie = storedCookie();
  assert.equal(cookie.value, 'partner-123');
  assert.equal(cookie.attrs.domain, undefined, 'localhost cookies are host-only');
  assert.ok(!('secure' in cookie.attrs));
});
