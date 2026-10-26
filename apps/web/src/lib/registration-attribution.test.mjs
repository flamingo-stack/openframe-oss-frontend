// Framework-free tests for the browser-side attribution capture.
//
// The frontend repo has no test runner; these run on Node's built-in test module with its
// native TypeScript stripping — `node --test src/lib/registration-attribution.test.mjs`, or
// `npm test`. They mock the browser globals the module touches (cookies, localStorage, the
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
    // `hostname`/`protocol` matter to the referral cookie writer and to which referrers count as
    // ours; the cookie-scope rules themselves are covered in referral-cookie.test.mjs, so this
    // mock keeps `name=value` only. `href` follows whatever a test sets on the other fields.
    location: {
      search: '',
      pathname: '/auth/',
      hostname: 'auth.openframe.ai',
      protocol: 'https:',
      get href() {
        return `${this.protocol}//${this.hostname}${this.pathname}${this.search}`;
      },
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
    dataLayer: undefined,
  };
  globalThis.document = {
    referrer: '',
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

test('the referral also rides the SSO continue URL', () => {
  cookies.push('of_ref=partner-123');
  const params = new URLSearchParams();
  A.appendAttributionQueryParams(params, A.collectRegistrationAttribution());

  assert.equal(params.get('ref'), 'partner-123');
});

// HubSpot's cross-domain linker hands the marketing site's visitor token over in the URL; that
// token, not the local cookie, is what ties the registration to the visitor's sessions there.
const HANDOFF_UTK = 'f74d91effc2c2bf182c7210840fa38cb';
const LOCAL_UTK = '0000000000000000000000000000aaaa';
const HANDOFF_SEARCH = `?__hstc=221035399.${HANDOFF_UTK}.1757900000000.1757900000000.1757900000000.1&__hssc=221035399.1.1757900000000&__hsfp=7ce18d99cccb9504bc1eef62d4b5d5cd`;

test('a HubSpot handoff in the URL beats the local hubspotutk cookie', () => {
  cookies.push(`hubspotutk=${LOCAL_UTK}`);
  window.location.search = HANDOFF_SEARCH;
  A.captureAttributionFromUrl();

  assert.equal(A.collectRegistrationAttribution().hutk, HANDOFF_UTK);
});

test('the handoff token survives the navigation from the landing page to signup', () => {
  window.location.search = HANDOFF_SEARCH;
  A.captureAttributionFromUrl(); // landing

  window.location.search = ''; // /auth — the params are gone from the address bar
  cookies.push(`hubspotutk=${LOCAL_UTK}`);
  assert.equal(A.collectRegistrationAttribution().hutk, HANDOFF_UTK);
});

test('a handoff straight to the signup page counts before the capture effect ran', () => {
  cookies.push(`hubspotutk=${LOCAL_UTK}`);
  window.location.search = HANDOFF_SEARCH;
  assert.equal(A.collectRegistrationAttribution().hutk, HANDOFF_UTK);
});

test('last handoff wins: HubSpot replaces the visitor identity on every merge, so does this', () => {
  window.location.search = HANDOFF_SEARCH;
  A.captureAttributionFromUrl();

  const later = '0123456789abcdef0123456789abcdef';
  window.location.search = HANDOFF_SEARCH.replace(HANDOFF_UTK, later);
  A.captureAttributionFromUrl();

  assert.equal(A.collectRegistrationAttribution().hutk, later);
});

test("a malformed __hstc, or one without the linker's __hsfp, falls back to the cookie", () => {
  cookies.push(`hubspotutk=${LOCAL_UTK}`);
  for (const search of ['?__hstc=not-a-hubspot-value&__hsfp=fp', `?__hstc=221035399.${HANDOFF_UTK}.1.1.1.1`]) {
    window.location.search = search;
    A.captureAttributionFromUrl();
    assert.equal(A.collectRegistrationAttribution().hutk, LOCAL_UTK, search);
  }
  assert.equal(store.of_attr_hutk, undefined, 'a rejected handoff stores no token');
});

test('hubspotUtkFromHstc reads the token slot and nothing else', () => {
  assert.equal(A.hubspotUtkFromHstc(`221035399.${HANDOFF_UTK}.1.1.1.1`), HANDOFF_UTK);
  assert.equal(A.hubspotUtkFromHstc(HANDOFF_UTK), undefined, 'a bare token is not a __hstc value');
  assert.equal(A.hubspotUtkFromHstc('221035399.short.1.1.1.1'), undefined);
  assert.equal(A.hubspotUtkFromHstc(undefined), undefined);
});

// The visit: where the visitor came from and the first page they saw, from the page load they
// arrived on. The backend reads the channel off the referrer's host.
function visitOf(got) {
  return { referrer: got.referrer, landingUrl: got.landingUrl };
}

test('an arrival records its referrer and landing page, both without query or fragment', () => {
  document.referrer = 'https://chatgpt.com/c/abc?model=x#top';
  window.location.search = '?utm_source=chatgpt&token=secret';
  A.captureAttributionFromUrl();

  window.location.pathname = '/auth/signup/'; // the visitor moves on before signing up
  window.location.search = '';
  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://chatgpt.com/c/abc',
    landingUrl: 'https://auth.openframe.ai/auth/',
  });
});

test('the first arrival wins: a later page load does not replace the visit', () => {
  document.referrer = 'https://chatgpt.com/';
  A.captureAttributionFromUrl();

  document.referrer = 'https://www.bing.com/';
  window.location.pathname = '/auth/login/';
  A.captureAttributionFromUrl();

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://chatgpt.com/',
    landingUrl: 'https://auth.openframe.ai/auth/',
  });
});

// "Direct" names no channel, so the first arrival that does name one replaces it, as a whole
// pair, never its referrer next to the direct visit's landing page.
test('a direct visit gives way to the first later arrival with a referrer', () => {
  A.captureAttributionFromUrl(); // direct, on /auth/

  document.referrer = 'https://chatgpt.com/';
  window.location.pathname = '/auth/login/';
  A.captureAttributionFromUrl();

  document.referrer = 'https://www.bing.com/';
  window.location.pathname = '/auth/signup/';
  A.captureAttributionFromUrl(); // the referred visit is final

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://chatgpt.com/',
    landingUrl: 'https://auth.openframe.ai/auth/login/',
  });
});

test("a direct visit gives way to the marketing site's handoff", () => {
  A.captureAttributionFromUrl(); // direct, on /auth/

  window.location.search = `?referrer=${encodeURIComponent('https://www.google.com/')}&landing_url=${encodeURIComponent('https://flamingo.run/pricing')}`;
  A.captureAttributionFromUrl();

  window.location.search = '';
  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://www.google.com/',
    landingUrl: 'https://flamingo.run/pricing',
  });
});

test("the replacing visit takes the direct one's landing page with it", () => {
  A.captureAttributionFromUrl(); // direct, on /auth/

  window.location.search = `?referrer=${encodeURIComponent('https://www.google.com/')}`;
  A.captureAttributionFromUrl(); // a handoff that names its source but not its landing page

  window.location.search = '';
  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://www.google.com/',
    landingUrl: undefined,
  });
});

test('a later direct page load keeps the first direct visit', () => {
  A.captureAttributionFromUrl(); // direct, on /auth/

  window.location.pathname = '/auth/login/';
  A.captureAttributionFromUrl();

  assert.equal(A.collectRegistrationAttribution().landingUrl, 'https://auth.openframe.ai/auth/');
});

test('a signup on a referred page load counts it over a stored direct visit, before the capture effect ran', () => {
  A.captureAttributionFromUrl(); // direct, on /auth/

  document.referrer = 'https://www.perplexity.ai/';
  window.location.pathname = '/auth/signup/';
  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://www.perplexity.ai/',
    landingUrl: 'https://auth.openframe.ai/auth/signup/',
  });
});

test('a direct arrival records the landing page alone', () => {
  A.captureAttributionFromUrl();

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: undefined,
    landingUrl: 'https://auth.openframe.ai/auth/',
  });
});

test("the marketing site's handoff visit beats this page's own", () => {
  document.referrer = 'https://flamingo.run/pricing';
  window.location.search = `?referrer=${encodeURIComponent('https://www.google.com/')}&landing_url=${encodeURIComponent('https://flamingo.run/pricing?utm_source=x')}`;
  A.captureAttributionFromUrl();

  window.location.search = '';
  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://www.google.com/',
    landingUrl: 'https://flamingo.run/pricing',
  });
});

test('a handoff without a referrer is a direct visit to the marketing site', () => {
  document.referrer = 'https://flamingo.run/';
  window.location.search = `?landing_url=${encodeURIComponent('https://flamingo.run/')}`;
  A.captureAttributionFromUrl();

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: undefined,
    landingUrl: 'https://flamingo.run/',
  });
});

test('a handoff straight to the signup page counts its visit before the capture effect ran', () => {
  window.location.search = `?referrer=${encodeURIComponent('https://www.reddit.com/r/msp/')}&landing_url=${encodeURIComponent('https://flamingo.run/')}`;

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://www.reddit.com/r/msp/',
    landingUrl: 'https://flamingo.run/',
  });
});

// An SSO return carries the provider's sign-in page as its referrer; recorded, it would read as
// organic search (Google) or a referral (Microsoft, Apple).
test('coming back from a sign-in page is not an arrival', () => {
  for (const referrer of [
    'https://accounts.google.com/',
    'https://login.microsoftonline.com/',
    'https://appleid.apple.com/',
  ]) {
    resetBrowser();
    document.referrer = referrer;
    window.location.pathname = '/auth/sso-continue/';
    A.captureAttributionFromUrl();

    assert.equal(store.of_attr_referrer, undefined, referrer);
    assert.equal(store.of_attr_landing_url, undefined, referrer);
    assert.deepEqual(
      visitOf(A.collectRegistrationAttribution()),
      { referrer: undefined, landingUrl: undefined },
      referrer,
    );
  }
});

test('a sign-in return keeps the visit of the real arrival', () => {
  document.referrer = 'https://chatgpt.com/';
  A.captureAttributionFromUrl();

  document.referrer = 'https://accounts.google.com/';
  window.location.pathname = '/auth/sso-continue/';
  A.captureAttributionFromUrl();

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://chatgpt.com/',
    landingUrl: 'https://auth.openframe.ai/auth/',
  });
});

// The marketing sites are ours: their own source is theirs to hand over (the handoff above).
test('a page load from one of our own sites is not an arrival', () => {
  for (const referrer of [
    'https://auth.openframe.ai/auth/',
    'https://openframe.ai/',
    'https://flamingo.run/',
    'https://www.openmsp.ai/',
  ]) {
    resetBrowser();
    document.referrer = referrer;
    A.captureAttributionFromUrl();

    assert.deepEqual(
      visitOf(A.collectRegistrationAttribution()),
      { referrer: undefined, landingUrl: undefined },
      referrer,
    );
  }
});

test('a handoff referrer that is a sign-in page or ours is dropped, its landing page kept', () => {
  window.location.search = `?referrer=${encodeURIComponent('https://accounts.google.com/')}&landing_url=${encodeURIComponent('https://flamingo.run/')}`;
  A.captureAttributionFromUrl();

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: undefined,
    landingUrl: 'https://flamingo.run/',
  });
});

test('a referrer that is not a web page counts as a direct arrival', () => {
  document.referrer = 'android-app://com.google.android.gm/';
  A.captureAttributionFromUrl();

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: undefined,
    landingUrl: 'https://auth.openframe.ai/auth/',
  });
});

test('a referrer over the 2048-character cap is dropped, not cut', () => {
  document.referrer = `https://example.com/${'a'.repeat(2048)}`;
  A.captureAttributionFromUrl();

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: undefined,
    landingUrl: 'https://auth.openframe.ai/auth/',
  });
});

test('no signals present yields only the always-minted event id', () => {
  const got = A.collectRegistrationAttribution();
  assert.equal(got.fbc, undefined);
  assert.equal(typeof got.eventId, 'string');
});

// The SSO continue URL must carry the same attribution set as the password-flow body — a field
// collected but silently dropped from the query string is exactly the kind of gap behind the
// low fbp coverage on one flow.
test('SSO query params carry every collected field, matching the password body', () => {
  cookies.push('_fbc=fb.1.170.AbC', '_fbp=fb.1.170.999', 'hubspotutk=hutk-abc');
  document.referrer = 'https://www.facebook.com/';
  window.location.search =
    '?fbclid=FBID&gclid=GG&rdt_cid=RD&li_fat_id=LI&utm_source=facebook&utm_medium=cpc&utm_campaign=q3&utm_content=v1&utm_term=msp';
  A.captureAttributionFromUrl();

  const collected = A.collectRegistrationAttribution();
  const params = new URLSearchParams({ tenantName: 'org', tenantDomain: 'org.openframe.example' });
  A.appendAttributionQueryParams(params, collected);

  // 3 cookies + 9 URL params + eventId + referrer + landingUrl = 15 fields, every one present as a
  // bare key alongside the two tenant params the endpoint takes as @RequestParam.
  assert.equal([...params.keys()].length, 15 + 2);
  assert.equal(params.get('referrer'), 'https://www.facebook.com/');
  assert.equal(params.get('landingUrl'), 'https://auth.openframe.ai/auth/');
  for (const [field, value] of Object.entries(collected)) {
    assert.equal(params.get(field), value, `${field} must ride the SSO continue URL`);
  }
});

test('SSO query serialization skips blank values instead of sending empty strings', () => {
  const params = new URLSearchParams();
  A.appendAttributionQueryParams(params, { fbp: 'fb.1.170.999', fbc: '', utmSource: '   ' });
  assert.deepEqual([...params.keys()], ['fbp']);
});

// The password-flow body runs explicit attribution through the same normalization, so a
// caller-supplied `{ fbp: '' }` is omitted identically on both flows.
test('normalizeAttribution drops blanks and collapses an all-blank object to undefined', () => {
  assert.deepEqual(A.normalizeAttribution({ fbp: 'fb.1.170.999', fbc: '', utmSource: '   ' }), {
    fbp: 'fb.1.170.999',
  });
  assert.equal(A.normalizeAttribution({ fbc: '', utmSource: '   ' }), undefined);
});
