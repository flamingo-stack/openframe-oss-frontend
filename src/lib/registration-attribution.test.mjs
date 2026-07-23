// Framework-free tests for the browser-side attribution capture.
//
// The frontend repo has no test runner; these run on Node's built-in test module with its
// native TypeScript stripping — `node --test src/lib/registration-attribution.test.mjs`, or
// `npm test`. They mock the browser globals the module touches (cookies, sessionStorage, the
// GTM dataLayer) and assert the observable payload, since the real cookies only exist in a
// live browser.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

let store = {};
let cookies = [];

function resetBrowser() {
  store = {};
  cookies = [];
  globalThis.window = {
    location: { search: '' },
    sessionStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: k => {
        delete store[k];
      },
    },
    dataLayer: undefined,
  };
  globalThis.document = {
    get cookie() {
      return cookies.join('; ');
    },
  };
  if (!globalThis.crypto) globalThis.crypto = {};
  globalThis.crypto.randomUUID = () => '11111111-2222-3333-4444-555555555555';
}

// Import once; the modules read globals lazily at call time, so re-mocking per test is enough.
const A = await import('./registration-attribution.ts');

beforeEach(resetBrowser);

test('collects cookies, URL params and a minted event id', () => {
  cookies.push('_fbc=fb.1.170.AbC', '_fbp=fb.1.170.999', 'hubspotutk=hutk-abc');
  window.location.search =
    '?fbclid=FBID&gclid=GG&rdt_cid=RD&li_fat_id=LI&utm_source=facebook&utm_medium=cpc&utm_campaign=q3&utm_content=v1&utm_term=msp';
  A.captureAttributionFromUrl();

  const got = A.collectRegistrationAttribution();
  assert.equal(got.fbc, 'fb.1.170.AbC');
  assert.equal(got.fbp, 'fb.1.170.999');
  assert.equal(got.hutk, 'hutk-abc', 'the HubSpot cookie rides to the backend for the form submission');
  assert.equal(got.fbclid, 'FBID');
  assert.equal(got.gclid, 'GG');
  assert.equal(got.rdtCid, 'RD');
  assert.equal(got.liFatId, 'LI');
  assert.equal(got.utmSource, 'facebook');
  assert.equal(got.utmMedium, 'cpc');
  assert.equal(got.utmCampaign, 'q3');
  assert.equal(got.utmContent, 'v1');
  assert.equal(got.utmTerm, 'msp');
  assert.equal(got.eventId, '11111111-2222-3333-4444-555555555555');
});

test('publishes the event id to the GTM dataLayer for a container-side Meta tag', () => {
  A.collectRegistrationAttribution();
  assert.deepEqual(window.dataLayer[0], {
    event: 'openframe_registration',
    metaEventId: '11111111-2222-3333-4444-555555555555',
  });
});

test('first touch wins: a landing param is kept over a later URL param', () => {
  window.location.search = '?utm_source=facebook';
  A.captureAttributionFromUrl(); // landing

  window.location.search = '?utm_source=later-should-not-win'; // a later, param-bearing page
  A.captureAttributionFromUrl(); // must not overwrite the stored landing value

  assert.equal(A.collectRegistrationAttribution().utmSource, 'facebook');
});

test('a direct landing on the signup page still captures its params', () => {
  // No prior capture; the live URL is the fallback source.
  window.location.search = '?utm_source=direct';
  assert.equal(A.collectRegistrationAttribution().utmSource, 'direct');
});

test('no signals present yields only the always-minted event id', () => {
  const got = A.collectRegistrationAttribution();
  assert.equal(got.fbc, undefined);
  assert.equal(typeof got.eventId, 'string');
});
