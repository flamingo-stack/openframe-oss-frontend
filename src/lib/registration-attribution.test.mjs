// Framework-free tests for the browser-side attribution capture.
//
// The frontend repo has no test runner; these run on Node's built-in test module with its
// native TypeScript stripping — `node --test src/lib/registration-attribution.test.mjs`, or
// `npm test`. They mock the browser globals the module touches (cookies, sessionStorage, the
// GTM dataLayer) and assert the observable payload, since the real cookies only exist in a
// live browser.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import './test-module-resolve.mjs';

let store = {};
let cookies = [];

function resetBrowser() {
  store = {};
  cookies = [];
  globalThis.window = {
    // `hostname`/`protocol` matter only to the referral cookie writer; the cookie-scope rules
    // themselves are covered in referral-cookie.test.mjs, so this mock keeps `name=value` only.
    location: { search: '', hostname: 'auth.openframe.ai', protocol: 'https:' },
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
    set cookie(raw) {
      const [name, value] = raw.split('; ')[0].split('=');
      cookies = cookies.filter(c => !c.startsWith(`${name}=`));
      cookies.push(`${name}=${value}`);
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

// The partner referral is the one signal that can predate this visit entirely — it rides a
// cookie set on another subdomain, possibly weeks earlier (see referral-cookie.ts).
test('the stored referral cookie rides the registration payload as `ref`', () => {
  cookies.push('of_ref=partner-123');
  assert.equal(A.collectRegistrationAttribution().ref, 'partner-123');
});

test('a partner link straight to the signup page captures and sends its referral', () => {
  window.location.search = '?ref=partner-456';
  A.captureAttributionFromUrl();

  assert.ok(cookies.includes('of_ref=partner-456'), 'the capture pass writes the cookie');
  assert.equal(A.collectRegistrationAttribution().ref, 'partner-456');
});

test('the referral also rides the SSO start URL', () => {
  cookies.push('of_ref=partner-123');
  const params = new URLSearchParams();
  A.appendAttributionQueryParams(params, A.collectRegistrationAttribution());

  assert.equal(params.get('attribution.ref'), 'partner-123');
});

test('no signals present yields only the always-minted event id', () => {
  const got = A.collectRegistrationAttribution();
  assert.equal(got.fbc, undefined);
  assert.equal(typeof got.eventId, 'string');
});

// The SSO start URL must carry the same attribution set as the password-flow body — a field
// collected but silently dropped from the query string is exactly the kind of gap behind the
// low fbp coverage on one flow (see Meta CAPI follow-up task 86ajt9vye, F1/F2).
test('SSO query params carry every collected field, matching the password body', () => {
  cookies.push('_fbc=fb.1.170.AbC', '_fbp=fb.1.170.999', 'hubspotutk=hutk-abc');
  window.location.search =
    '?fbclid=FBID&gclid=GG&rdt_cid=RD&li_fat_id=LI&utm_source=facebook&utm_medium=cpc&utm_campaign=q3&utm_content=v1&utm_term=msp';
  A.captureAttributionFromUrl();

  const collected = A.collectRegistrationAttribution();
  const params = new URLSearchParams({ tenantName: 'org', provider: 'google' });
  A.appendAttributionQueryParams(params, collected);

  // 3 cookies + 9 URL params + eventId = 13 fields, every one present as attribution.<field>.
  const attributionKeys = [...params.keys()].filter(k => k.startsWith('attribution.'));
  assert.equal(attributionKeys.length, 13);
  for (const [field, value] of Object.entries(collected)) {
    assert.equal(params.get(`attribution.${field}`), value, `attribution.${field} must ride the SSO start URL`);
  }
});

test('SSO query serialization skips blank values instead of sending empty strings', () => {
  const params = new URLSearchParams();
  A.appendAttributionQueryParams(params, { fbp: 'fb.1.170.999', fbc: '', utmSource: '   ' });
  assert.deepEqual([...params.keys()], ['attribution.fbp']);
});

// The password-flow body runs explicit attribution through the same normalization, so a
// caller-supplied `{ fbp: '' }` is omitted identically on both flows.
test('normalizeAttribution drops blanks and collapses an all-blank object to undefined', () => {
  assert.deepEqual(A.normalizeAttribution({ fbp: 'fb.1.170.999', fbc: '', utmSource: '   ' }), {
    fbp: 'fb.1.170.999',
  });
  assert.equal(A.normalizeAttribution({ fbc: '', utmSource: '   ' }), undefined);
});
