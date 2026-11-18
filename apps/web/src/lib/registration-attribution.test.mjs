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

// Import once; the modules read globals lazily at call time, so re-mocking per test is enough.
const A = await import('./registration-attribution.ts');
const V = await import('./visit-attribution.ts');

let store = {};
let cookies = [];

const T0 = Date.UTC(2026, 9, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
let now = T0;
Date.now = () => now;

function resetBrowser() {
  store = {};
  cookies = [];
  now = T0;
  V.startPageLoad();
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

/**
 * A new page load: this address, this referrer, at this time. Cookies and storage stay, as they
 * do across page loads.
 */
function pageLoad({ pathname = '/auth/', search = '', referrer = '', time = now } = {}) {
  V.startPageLoad();
  now = time;
  window.location.pathname = pathname;
  window.location.search = search;
  document.referrer = referrer;
  A.captureAttributionFromUrl();
}

beforeEach(resetBrowser);

test('collects cookies, URL params and a minted event id', () => {
  cookies.push('_fbc=fb.1.170.FBID', '_fbp=fb.1.170.999', 'hubspotutk=hutk-abc', '_rdt_uuid=1700000000000.Ab-Cd');
  window.location.search =
    '?fbclid=FBID&gclid=GG&gbraid=GbR&wbraid=WbR&rdt_cid=RD&li_fat_id=LI&utm_source=facebook&utm_medium=cpc&utm_campaign=q3&utm_content=v1&utm_term=msp';
  A.captureAttributionFromUrl();

  const got = A.collectRegistrationAttribution();
  assert.equal(got.fbc, 'fb.1.170.FBID');
  assert.equal(got.fbp, 'fb.1.170.999');
  assert.equal(got.rdtUuid, '1700000000000.Ab-Cd', 'the Reddit pixel cookie, exactly as read');
  assert.equal(got.firstVisit.gbraid, 'GbR');
  assert.equal(got.firstVisit.wbraid, 'WbR');
  assert.equal(got.hutk, 'hutk-abc', 'the HubSpot cookie rides to the backend for the form submission');
  assert.equal(got.firstVisit.fbclid, 'FBID');
  assert.equal(got.firstVisit.gclid, 'GG');
  assert.equal(got.firstVisit.rdtCid, 'RD');
  assert.equal(got.firstVisit.liFatId, 'LI');
  assert.equal(got.firstVisit.utmSource, 'facebook');
  assert.equal(got.firstVisit.utmMedium, 'cpc');
  assert.equal(got.firstVisit.utmCampaign, 'q3');
  assert.equal(got.firstVisit.utmContent, 'v1');
  assert.equal(got.firstVisit.utmTerm, 'msp');
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

  assert.equal(A.collectRegistrationAttribution().firstVisit.utmSource, 'facebook');
});

// Google's click ids for iOS traffic stand in for a gclid; the backend sends them to Google Ads.
test("Google's iOS click ids are kept first touch, like gclid", () => {
  window.location.search = '?gbraid=FIRST-g&wbraid=FIRST-w';
  A.captureAttributionFromUrl();
  window.location.search = '?gbraid=later&wbraid=later';
  A.captureAttributionFromUrl();

  const got = A.collectRegistrationAttribution();
  assert.equal(got.firstVisit.gbraid, 'FIRST-g');
  assert.equal(got.firstVisit.wbraid, 'FIRST-w');
});

test('the ad conversion values ride exactly as read, case and all', () => {
  cookies.push('_rdt_uuid=1700000000000.MiXeD-Case');
  window.location.search = '?gbraid=0AAAAA-MiXeD_case';

  const got = A.collectRegistrationAttribution();
  assert.equal(got.firstVisit.gbraid, '0AAAAA-MiXeD_case');
  assert.equal(got.rdtUuid, '1700000000000.MiXeD-Case');
});

test('a direct landing on the signup page still captures its params', () => {
  // No prior capture; the live URL is the fallback source.
  window.location.search = '?utm_source=direct';
  assert.equal(A.collectRegistrationAttribution().firstVisit.utmSource, 'direct');
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

// The visits: where the visitor came from and the first page they saw, from the page load they
// arrived on, first and latest. The rules themselves are
// visit-attribution.ts's (MPH runs the same file under jest); this is what the signup sends.
function visitOf(got) {
  return { referrer: got.firstVisit?.referrer, landingUrl: got.firstVisit?.landingUrl };
}

test('an arrival rides as the first and the latest visit, and nowhere else', () => {
  pageLoad({ search: '?utm_source=chatgpt&token=secret', referrer: 'https://chatgpt.com/c/abc?model=x#top' });
  pageLoad({ pathname: '/auth/signup/', time: T0 + 1000 }); // the visitor moves on before signing up

  const got = A.collectRegistrationAttribution();
  const visit = {
    utmSource: 'chatgpt',
    referrer: 'https://chatgpt.com/c/abc',
    landingUrl: 'https://auth.openframe.ai/auth/',
    landedAt: T0,
  };
  assert.deepEqual(got.firstVisit, visit);
  assert.deepEqual(got.lastVisit, visit);
  for (const flat of ['utmSource', 'referrer', 'landingUrl', 'landedAt']) assert.equal(got[flat], undefined, flat);
});

test('a later arrival is the latest visit, whole; the first stays', () => {
  pageLoad({ search: '?utm_source=facebook&fbclid=FB1', referrer: 'https://www.facebook.com/' });
  pageLoad({ pathname: '/auth/login/', referrer: 'https://www.bing.com/', time: T0 + DAY_MS });

  const got = A.collectRegistrationAttribution();
  assert.equal(got.firstVisit.utmSource, 'facebook');
  assert.deepEqual(got.lastVisit, {
    referrer: 'https://www.bing.com/',
    landingUrl: 'https://auth.openframe.ai/auth/login/',
    landedAt: T0 + DAY_MS,
  });
  assert.deepEqual(visitOf(got), {
    referrer: 'https://www.facebook.com/',
    landingUrl: 'https://auth.openframe.ai/auth/',
  });
});

test("each platform's latest click rides with the time it was first seen", () => {
  pageLoad({ search: '?fbclid=FB1&gclid=G1&rdt_cid=RD1&li_fat_id=LI1&gbraid=GB1' });
  pageLoad({ search: '?fbclid=FB2', time: T0 + DAY_MS });
  pageLoad({ search: '?fbclid=FB2', time: T0 + 2 * DAY_MS }); // a reload of the same link

  assert.deepEqual(A.collectRegistrationAttribution().latestClicks, {
    meta: { fbclid: 'FB2', clickedAt: T0 + DAY_MS },
    google: { gclid: 'G1', clickedAt: T0 },
    reddit: { rdtCid: 'RD1', clickedAt: T0 },
    linkedin: { liFatId: 'LI1', clickedAt: T0 },
  });
});

test('a direct visit gives way to the first arrival, in both visits', () => {
  pageLoad();
  pageLoad({ pathname: '/auth/login/', time: T0 + 1000 });
  assert.equal(A.collectTouchpoint().firstVisit.landingUrl, 'https://auth.openframe.ai/auth/');

  pageLoad({ pathname: '/auth/signup/', referrer: 'https://www.perplexity.ai/', time: T0 + 2000 });
  const got = A.collectTouchpoint();
  const visit = {
    referrer: 'https://www.perplexity.ai/',
    landingUrl: 'https://auth.openframe.ai/auth/signup/',
    landedAt: T0 + 2000,
  };
  assert.deepEqual(got.firstVisit, visit);
  assert.deepEqual(got.lastVisit, visit);
});

test('a signup on a referred page load counts it, before the capture effect ran', () => {
  pageLoad();
  V.startPageLoad();
  window.location.pathname = '/auth/signup/';
  document.referrer = 'https://www.perplexity.ai/';

  assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
    referrer: 'https://www.perplexity.ai/',
    landingUrl: 'https://auth.openframe.ai/auth/signup/',
  });
});

test('a client-side navigation is not an arrival: the referrer was the page load', () => {
  pageLoad({ referrer: 'https://www.google.com/' });
  now = T0 + 1000;
  window.location.pathname = '/auth/signup/';
  assert.deepEqual(A.collectTouchpoint().lastVisit, {
    referrer: 'https://www.google.com/',
    landingUrl: 'https://auth.openframe.ai/auth/',
    landedAt: T0,
  });
});

test("the marketing site's handoff is merged by time, its flat parameters ignored", () => {
  pageLoad({ search: '?utm_source=here&gclid=G_HERE', time: T0 });
  const handoff = new URLSearchParams({
    'first_visit.utm_source': 'facebook',
    'first_visit.fbclid': 'FB1',
    'first_visit.referrer': 'https://www.facebook.com/',
    'first_visit.landing_url': 'https://flamingo.run/pricing',
    'first_visit.landed_at': String(T0 - DAY_MS),
    'last_visit.referrer': 'https://www.google.com/',
    'last_visit.landing_url': 'https://flamingo.run/blog',
    'last_visit.landed_at': String(T0 + 500),
    'latest_clicks.meta.fbclid': 'FB1',
    'latest_clicks.meta.clicked_at': String(T0 - DAY_MS),
    'latest_clicks.google.gclid': 'G_THERE',
    'latest_clicks.google.clicked_at': String(T0 - 1),
    utm_source: 'facebook',
    referrer: 'https://www.facebook.com/',
  });
  pageLoad({ search: `?${handoff}`, referrer: 'https://flamingo.run/blog', time: T0 + 1000 });

  const got = A.collectRegistrationAttribution();
  assert.deepEqual(got.firstVisit, {
    utmSource: 'facebook',
    fbclid: 'FB1',
    referrer: 'https://www.facebook.com/',
    landingUrl: 'https://flamingo.run/pricing',
    landedAt: T0 - DAY_MS,
  });
  assert.deepEqual(got.lastVisit, {
    referrer: 'https://www.google.com/',
    landingUrl: 'https://flamingo.run/blog',
    landedAt: T0 + 500,
  });
  assert.deepEqual(got.latestClicks, {
    meta: { fbclid: 'FB1', clickedAt: T0 - DAY_MS },
    google: { gclid: 'G_HERE', clickedAt: T0 },
  });
});

test("an older marketing site's flat handoff is an arrival with the visit it saw", () => {
  pageLoad({
    search: `?utm_source=x&referrer=${encodeURIComponent('https://www.google.com/')}&landing_url=${encodeURIComponent('https://flamingo.run/pricing?utm_source=x')}`,
    referrer: 'https://flamingo.run/pricing',
  });
  assert.deepEqual(A.collectRegistrationAttribution().firstVisit, {
    utmSource: 'x',
    referrer: 'https://www.google.com/',
    landingUrl: 'https://flamingo.run/pricing',
    landedAt: T0,
  });
});

test('entries saved before visits become both visits and the clicks, then are gone', () => {
  for (const [param, value, t] of [
    ['utm_source', 'facebook', T0 - 3 * DAY_MS],
    ['fbclid', 'FB1', T0 - 2 * DAY_MS],
    ['referrer', 'https://www.facebook.com/', T0 - 3 * DAY_MS],
    ['landing_url', 'https://auth.openframe.ai/auth/', T0 - 3 * DAY_MS],
  ]) {
    store[`of_attr_${param}`] = JSON.stringify({ v: value, t });
  }
  document.referrer = 'https://openframe.ai/';

  const got = A.collectRegistrationAttribution();
  const visit = {
    utmSource: 'facebook',
    fbclid: 'FB1',
    referrer: 'https://www.facebook.com/',
    landingUrl: 'https://auth.openframe.ai/auth/',
    landedAt: T0 - 3 * DAY_MS,
  };
  assert.deepEqual(got.firstVisit, visit);
  assert.deepEqual(got.lastVisit, visit);
  assert.deepEqual(got.latestClicks, { meta: { fbclid: 'FB1', clickedAt: T0 - 2 * DAY_MS } });
  assert.equal(store.of_attr_utm_source, undefined);
});

test('a visit expires 90 days after its time', () => {
  pageLoad({ search: '?utm_source=old' });
  now = T0 + 91 * DAY_MS;
  document.referrer = 'https://openframe.ai/';
  const got = A.collectRegistrationAttribution();
  assert.equal(got.firstVisit, undefined);
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
    pageLoad({ pathname: '/auth/sso-continue/', referrer });
    const got = A.collectRegistrationAttribution();
    assert.equal(got.firstVisit, undefined, referrer);
    assert.deepEqual(visitOf(got), { referrer: undefined, landingUrl: undefined }, referrer);
  }
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
    pageLoad({ referrer });
    assert.equal(A.collectRegistrationAttribution().firstVisit, undefined, referrer);
  }
});

test('a referrer that is not a web page, or is over the cap, counts as a direct arrival', () => {
  for (const referrer of ['android-app://com.google.android.gm/', `https://example.com/${'a'.repeat(2048)}`]) {
    resetBrowser();
    pageLoad({ referrer });
    assert.deepEqual(visitOf(A.collectRegistrationAttribution()), {
      referrer: undefined,
      landingUrl: 'https://auth.openframe.ai/auth/',
    });
  }
});

// The desktop app's "Open the app" link: the shell hands the page the id the installer was
// downloaded with, and the signup sends it so the backend can claim that download's source.
const DOWNLOAD_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

test('a stored download id rides the signup as downloadId', () => {
  A.storeDownloadId(DOWNLOAD_ID);
  assert.equal(A.collectRegistrationAttribution().downloadId, DOWNLOAD_ID);
});

test('the download id is kept lowercase, as the gateway records it', () => {
  A.storeDownloadId(` ${DOWNLOAD_ID.toUpperCase()} `);
  assert.equal(A.collectRegistrationAttribution().downloadId, DOWNLOAD_ID);
});

test('the latest download id wins', () => {
  A.storeDownloadId(DOWNLOAD_ID);
  A.storeDownloadId('11111111-2222-4333-8444-555555555555');
  assert.equal(A.collectRegistrationAttribution().downloadId, '11111111-2222-4333-8444-555555555555');
});

test('an id that is not a UUID is dropped and leaves the stored one alone', () => {
  A.storeDownloadId(DOWNLOAD_ID);
  for (const id of ['', 'not-a-uuid', '0f8fad5bd9cb469fa16570867728950e', `${DOWNLOAD_ID}x`]) {
    A.storeDownloadId(id);
  }
  assert.equal(A.collectRegistrationAttribution().downloadId, DOWNLOAD_ID);
});

test('whether a download id is kept: none, then the stored one, then none once it expired', () => {
  assert.equal(A.hasStoredDownloadId(), false);
  A.storeDownloadId(DOWNLOAD_ID);
  assert.equal(A.hasStoredDownloadId(), true);
  now += 91 * DAY_MS;
  assert.equal(A.hasStoredDownloadId(), false);
});

test('the download id rides the SSO continue URL too', () => {
  A.storeDownloadId(DOWNLOAD_ID);
  const params = new URLSearchParams();
  A.appendAttributionQueryParams(params, A.collectRegistrationAttribution());
  assert.equal(params.get('downloadId'), DOWNLOAD_ID);
});

// The "Send me download link" page sends the same attribution, but it is not a registration: no
// event id is minted, and nothing reaches the dataLayer for Meta's registration tag.
test('the touchpoint carries every signal the registration does, without the event id', () => {
  cookies.push('_fbp=fb.1.170.999', '_rdt_uuid=1700000000000.uuid');
  document.referrer = 'https://www.reddit.com/';
  window.location.search = '?utm_source=reddit&gbraid=GB';
  A.captureAttributionFromUrl();

  const touchpoint = A.collectTouchpoint();
  assert.equal(touchpoint.eventId, undefined);
  assert.equal(window.dataLayer, undefined, 'nothing is published for the registration tag');

  const { eventId, ...registration } = A.collectRegistrationAttribution();
  assert.equal(typeof eventId, 'string');
  assert.deepEqual(touchpoint, registration);
});

test('with no signals at all, the touchpoint is this page as a direct visit', () => {
  const visit = { landingUrl: 'https://auth.openframe.ai/auth/', landedAt: T0 };
  assert.deepEqual(A.collectTouchpoint(), {
    firstVisit: visit,
    lastVisit: visit,
  });
});

// The marketing site's `_fbc` rides its links as `fbc`: it names the click with the time it was
// made, while the pixel here mints its own when the handoff lands.
test('a handoff fbc is kept for the signup made later', () => {
  pageLoad({ search: '?fbc=fb.1.1700000000000.FB1' });
  pageLoad({ search: '', time: T0 + DAY_MS });
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000000000.FB1');
});

test('of the same click, the fbc made first wins: the handoff over the cookie the pixel minted here', () => {
  pageLoad({ search: '?fbc=fb.1.1700000000000.FB1' });
  cookies.push('_fbc=fb.1.1700000900000.FB1');
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000000000.FB1');
});

test('of two clicks, the later fbc wins', () => {
  pageLoad({ search: '?fbc=fb.1.1700000000000.FB1' });
  cookies.push('_fbc=fb.1.1700000900000.FB2');
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000900000.FB2');
  cookies = ['_fbc=fb.1.1600000000000.FB0'];
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000000000.FB1');
});

test('a later handoff of the same click keeps the earlier fbc; a new click replaces it', () => {
  pageLoad({ search: '?fbc=fb.1.1700000000000.FB1' });
  pageLoad({ search: '?fbc=fb.2.1700000500000.FB1', time: T0 + DAY_MS });
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000000000.FB1');
  pageLoad({ search: '?fbc=fb.1.1700000900000.FB2', time: T0 + 2 * DAY_MS });
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000900000.FB2');
});

test('a handoff fbc counts before the capture ran, and one the backend would refuse never', () => {
  window.location.search = '?fbc=fb.1.1700000000000.FB1';
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000000000.FB1');
  for (const fbc of [
    'not-an-fbc',
    'fb.1.1700000000000.FB1/x',
    'fb.1.1234567890123456789.FB1',
    `fb.1.1700000000000.${'F'.repeat(500)}`,
  ]) {
    resetBrowser();
    pageLoad({ search: `?fbc=${encodeURIComponent(fbc)}` });
    assert.equal(A.collectTouchpoint().fbc, undefined, fbc);
    assert.equal(store.of_attr_fbc, undefined, fbc);
  }
});

test('a cookie that cannot be read gives way to a handoff fbc that can', () => {
  pageLoad({ search: '?fbc=fb.1.1700000000000.FB1' });
  cookies.push('_fbc=garbled');
  assert.equal(A.collectTouchpoint().fbc, 'fb.1.1700000000000.FB1');
  resetBrowser();
  cookies.push('_fbc=garbled');
  assert.equal(A.collectTouchpoint().fbc, undefined);
});

// The gateway and the pixel mint `_fbc` from a link's `fbclid`, dated by that page load, and a
// handoff's flat parameters are the first visit's: that click must not pass for the latest one.
test('a cookie minted late from an older click never outranks the latest click', () => {
  pageLoad({ search: '?fbclid=FB0' });
  pageLoad({ search: '?fbclid=FB1', time: T0 + DAY_MS });
  cookies.push(`_fbc=fb.1.${T0 + 2 * DAY_MS}.FB0`);
  assert.equal(A.collectTouchpoint().fbc, undefined);
  assert.deepEqual(A.collectTouchpoint().latestClicks.meta, { fbclid: 'FB1', clickedAt: T0 + DAY_MS });
  pageLoad({ search: `?fbc=fb.1.${T0 + DAY_MS}.FB1`, time: T0 + 2 * DAY_MS });
  assert.equal(A.collectTouchpoint().fbc, `fb.1.${T0 + DAY_MS}.FB1`);
});

test('parseFbc reads the backend format and nothing else', () => {
  assert.deepEqual(V.parseFbc('fb.1.1700000000000.IwAR-x_y.z'), { id: 'IwAR-x_y.z', clickedAt: 1700000000000 });
  for (const value of [
    undefined,
    '',
    'fb.1.170',
    'fb.x.170.FB1',
    'fb.1.1234567890123456789.FB1',
    'fb.1.170.FB1/x',
    `fb.1.170.${'F'.repeat(512)}`,
  ]) {
    assert.equal(V.parseFbc(value), undefined, String(value));
  }
});

test('pickFbc: the latest click, the earliest fbc of it, each click dated by when it was first seen', () => {
  const nothingSeen = { latestClicks: {} };
  assert.equal(V.pickFbc([undefined, 'garbled'], nothingSeen), undefined);
  assert.equal(V.pickFbc(['fb.1.200.FB1', 'fb.1.100.FB1'], nothingSeen), 'fb.1.100.FB1');
  assert.equal(V.pickFbc(['fb.1.100.FB1', 'fb.1.300.FB2'], nothingSeen), 'fb.1.300.FB2');
  const seen = {
    firstVisit: { fields: { fbclid: 'FB1' }, landedAt: 100 },
    latestClicks: { meta: { id: 'FB2', clickedAt: 200 } },
  };
  assert.equal(V.pickFbc(['fb.1.900.FB1'], seen), undefined, 'FB1 minted late is still the older click');
  assert.equal(V.pickFbc(['fb.1.900.FB1', 'fb.1.250.FB2'], seen), 'fb.1.250.FB2');
});

test('a handoff fbc expires after 90 days', () => {
  pageLoad({ search: '?fbc=fb.1.1700000000000.FB1' });
  pageLoad({ search: '', time: T0 + 91 * DAY_MS });
  assert.equal(A.collectTouchpoint().fbc, undefined);
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
  cookies.push('_fbc=fb.1.170.FBID', '_fbp=fb.1.170.999', 'hubspotutk=hutk-abc', '_rdt_uuid=1700000000000.uuid');
  document.referrer = 'https://www.facebook.com/';
  window.location.search =
    '?fbclid=FBID&gclid=GG&gbraid=GB&wbraid=WB&rdt_cid=RD&li_fat_id=LI&utm_source=facebook&utm_medium=cpc&utm_campaign=q3&utm_content=v1&utm_term=msp';
  A.captureAttributionFromUrl();

  const collected = A.collectRegistrationAttribution();
  const params = new URLSearchParams({ tenantName: 'org', tenantDomain: 'org.openframe.example' });
  A.appendAttributionQueryParams(params, collected);

  // 4 cookies + eventId = 5 top-level fields, the two visits' 14 each and the four clicks' 2 each
  // with dots, beside the two tenant params the endpoint takes as @RequestParam. No flat visit.
  assert.equal([...params.keys()].length, 5 + 2 * 14 + 4 * 2 + 2);
  assert.equal(params.has('utmSource'), false);
  assert.equal(params.get('firstVisit.utmSource'), 'facebook');
  assert.equal(params.get('lastVisit.landedAt'), String(T0));
  assert.equal(params.get('latestClicks.meta.fbclid'), 'FBID');
  assert.equal(params.get('latestClicks.linkedin.clickedAt'), String(T0));
  for (const [field, value] of Object.entries(collected)) {
    if (typeof value === 'string') assert.equal(params.get(field), value, `${field} must ride the SSO continue URL`);
  }
});

test('SSO query serialization skips blank values instead of sending empty strings', () => {
  const params = new URLSearchParams();
  A.appendAttributionQueryParams(params, { fbp: 'fb.1.170.999', fbc: '', hutk: '   ' });
  assert.deepEqual([...params.keys()], ['fbp']);
});

// The password-flow body runs explicit attribution through the same normalization, so a
// caller-supplied `{ fbp: '' }` is omitted identically on both flows.
test('normalizeAttribution drops blanks and collapses an all-blank object to undefined', () => {
  assert.deepEqual(A.normalizeAttribution({ fbp: 'fb.1.170.999', fbc: '', hutk: '   ' }), {
    fbp: 'fb.1.170.999',
  });
  assert.equal(A.normalizeAttribution({ fbc: '', hutk: '   ' }), undefined);
});

test('normalizeAttribution keeps the times and drops a nested object that is all blank', () => {
  assert.deepEqual(
    A.normalizeAttribution({
      firstVisit: { utmSource: ' ', landedAt: T0 },
      lastVisit: { utmSource: '' },
      latestClicks: {},
    }),
    { firstVisit: { landedAt: T0 } },
  );
});
