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
    href: 'http://tauri.localhost/auth/?utm_source=desktop',
  },
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
  assert.equal(got.referrer, undefined);
  assert.equal(got.landingUrl, undefined);
  assert.equal(got.utmSource, 'desktop', 'the rest of the attribution still rides along');
});
