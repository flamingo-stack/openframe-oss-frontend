// The app shells load the same attribution module, but a page there is a bundle URL with no
// referrer (`http://tauri.localhost/…` on Windows), so it must record and send no visit. Its own
// file because the shell kind is detected once per process (`platform.ts`), and the suite in
// registration-attribution.test.mjs runs as the web.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import './test-module-resolve.mjs';

const store = {};

globalThis.window = {
  __TAURI_INTERNALS__: {},
  location: {
    search: '?utm_source=desktop',
    hostname: 'tauri.localhost',
    protocol: 'http:',
    pathname: '/auth/',
    href: 'http://tauri.localhost/auth/?utm_source=desktop',
  },
  // A marker in this storage would be a bug elsewhere; a shell never sends one all the same.
  sessionStorage: { getItem: k => (k === 'of_signup_started_in' ? 'desktop' : null), removeItem: () => {} },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: k => {
      delete store[k];
    },
  },
};
globalThis.document = { cookie: '', referrer: 'https://www.google.com/' };

const A = await import('./registration-attribution.ts');

test('the desktop shell records no visit and sends none', () => {
  A.captureAttributionFromUrl();
  assert.equal(store.of_attr_referrer, undefined);
  assert.equal(store.of_attr_landing_url, undefined);

  const got = A.collectRegistrationAttribution();
  assert.equal(got.firstVisit.referrer, undefined);
  assert.equal(got.firstVisit.landingUrl, undefined);
  assert.equal(got.firstVisit.utmSource, 'desktop', 'the rest of the attribution still rides along');
});

test('a sign-up inside the shell sends no startedIn: its request already says which app it is', () => {
  assert.equal(A.collectRegistrationAttribution().startedIn, undefined);
});
