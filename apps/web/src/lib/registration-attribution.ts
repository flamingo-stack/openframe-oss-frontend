import {
  getPlatformByHostname,
  hostOf,
  toRegistrableBaseDomain,
} from '@flamingo-stack/openframe-frontend-core/platform-domains';
import { sanitizeLandingUrl } from '@flamingo-stack/openframe-frontend-core/utils';
import { readCookie } from './cookies';
import { isAppShell } from './platform';
import { captureReferralFromUrl, REFERRAL_URL_PARAM, readReferralCode, sanitizeReferralCode } from './referral-cookie';

/**
 * Marketing-attribution signals collected at registration time, shaped to match the backend
 * `Touchpoint` DTO: field names here must stay in sync with that Java class.
 *
 * Three different lifetimes are at play, which is why this file has both a capture step and a
 * collect step:
 *
 * - **Cookies** (`_fbc`, `_fbp`, and Reddit's `_rdt_uuid`) are written by the ad pixels. They
 *   are not HttpOnly, they live on the openframe.ai origin, and they are still there at submit
 *   time, so they are read directly when the form is submitted, and the register request does
 *   not need to be same-domain.
 *
 * - **URL parameters** (`fbclid`, `gclid`, `gbraid`, `wbraid`, `rdt_cid`, `li_fat_id`, `utm_*`)
 *   exist only in the address bar of the *landing* page. A visitor who lands on `/` and then
 *   navigates to `/auth` has already lost them, so they are captured into localStorage on first
 *   load (see `captureAttributionFromUrl`, mounted app-wide) and read back at submit. Each entry
 *   carries its capture timestamp and expires after 90 days (enforced in code, because
 *   localStorage itself never expires), so the ad click survives the tab being closed and a
 *   return visit days later, without attributing signups to clicks from another quarter. Known
 *   limitation: Safari ITP caps script-writable storage at ~7 days; accepted as-is.
 *
 * - **The visit** (`referrer`, `landingUrl`) is where the visitor came from and the first page
 *   they saw, kept as a pair from the page load they *arrived* on, first touch, in the same
 *   90-day localStorage, except that a direct visit (no referrer) gives way to the first later
 *   arrival that has one, since "direct" names no channel. Both are reduced to `origin + pathname` (`sanitizeLandingUrl`): a raw
 *   URL can carry tokens and email addresses, and this one goes to HubSpot. A visit handed over
 *   by the marketing site (`?referrer=…&landing_url=…`) is the one it saw, so it beats this
 *   page's own. A page load that came from one of our own sites, or back from a sign-in page,
 *   is not an arrival and records no visit: an SSO return carries `accounts.google.com` as its
 *   referrer, which the backend would count as organic search. Neither is recorded inside the
 *   app shells, where there is no referrer and the page is a bundle URL.
 *
 * - **The download id** (`downloadId`) exists in the desktop app only: the download page's
 *   "Open the app" link hands the shell the id the installer was downloaded with, and the page
 *   takes it from there (`native-shell-initializer.tsx`) into the same storage. Last touch: the
 *   latest link names the install the person is signing up from.
 *
 * - **The HubSpot visitor token** is a cookie too (`hubspotutk`), but the token the contact
 *   should get is the *marketing site's*: the visitor's sessions and the ad click live on
 *   flamingo.run, under the token HubSpot's cross-domain linker writes into `__hstc` on the
 *   link to `/auth`. HubSpot merges that token into the local cookie only when a browser
 *   fingerprint it computes asynchronously is already there at tracker start-up — which it is
 *   not, so a returning visitor keeps the local token and the handoff is dropped (the GTM
 *   container seeds it for a first visit only). The incoming token is therefore captured into
 *   localStorage as well and preferred over the local cookie at submit: the outcome HubSpot's
 *   own merge produces when it wins. Last touch, unlike the ad parameters — `__hstc` names the
 *   visitor, not a click, and HubSpot itself replaces the local identity with every incoming
 *   one it accepts. The trust rule is the container's (a well-formed `__hstc` next to a
 *   `__hsfp`); neither verifies the fingerprint, so a forwarded handoff link would attribute
 *   its registrant to the sender's visitor — accepted, as it already is for first visits.
 *
 * - **The partner referral** (`?ref=`) is different still. It is clicked on the marketing site
 *   (`openframe.ai`) and redeemed on the signup app (`auth.openframe.ai`) — localStorage is
 *   origin-scoped, so it cannot make that hop. It gets its own 90-day cookie on the shared
 *   base domain; `referral-cookie.ts` owns that mechanism and the last-touch policy behind it.
 */

/** Backend DTO shape. Every field optional; absent means "never send this property". */
export interface Touchpoint {
  /** Full `_fbc` cookie value — never truncate. */
  fbc?: string;
  /** `fbclid` from the landing URL; the backend uses it only when `_fbc` is absent. */
  fbclid?: string;
  /** `_fbp` cookie value — the Meta browser id, sent to Meta as `fbp`. */
  fbp?: string;
  /** HubSpot visitor token (utk): the marketing site's when the visitor came from there, else
   * the local `hubspotutk` cookie (see the header). The backend puts it in the registration
   * form submission, which is what gives the contact its real traffic source. */
  hutk?: string;
  /** Google click id. */
  gclid?: string;
  /** Google's click id for iOS app traffic, used when there is no `gclid`. */
  gbraid?: string;
  /** Google's click id for iOS web traffic, used when there is no `gclid`. */
  wbraid?: string;
  /** Reddit click id. */
  rdtCid?: string;
  /** `_rdt_uuid` cookie value: the Reddit pixel's browser id, sent to Reddit with the signup. */
  rdtUuid?: string;
  /** LinkedIn click id. */
  liFatId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** Shared id for pixel/server deduplication; generated at form submit. */
  eventId?: string;
  /** Partner referral code from the `of_ref` cookie — see `referral-cookie.ts`. */
  ref?: string;
  /** The page the visitor came from, `origin + pathname` (see the header). The backend reads the
   * channel from its host: a search engine, an AI assistant, or another site. */
  referrer?: string;
  /** The first page of the visit, `origin + pathname` (see the header). */
  landingUrl?: string;
  /** The id the desktop installer was downloaded with, handed to the app by its "Open the app" link. */
  downloadId?: string;
  /** The desktop app's "How did you hear about us?" answer: `search`, `ai`, `producthunt`,
   * `social_ad`, `newsletter`, `friend`, `partner` or `other`. */
  heardFrom?: string;
  /** The text typed beside the `other` answer. */
  heardFromOther?: string;
}

/**
 * URL parameter -> DTO field. Each entry also becomes a localStorage key (prefixed), so
 * adding a network here is a one-line change that flows through capture, storage and submit.
 */
const URL_PARAM_TO_FIELD: Record<string, keyof Touchpoint> = {
  fbclid: 'fbclid',
  gclid: 'gclid',
  gbraid: 'gbraid',
  wbraid: 'wbraid',
  rdt_cid: 'rdtCid',
  li_fat_id: 'liFatId',
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
};

/**
 * What HubSpot's cross-domain linker appends to a link between the portal's domains: the
 * visitor's `__hstc` cookie value, a session marker (`__hssc`) and the sender's browser
 * fingerprint (`__hsfp`).
 */
const HUBSPOT_HSTC_PARAM = '__hstc';
const HUBSPOT_HSFP_PARAM = '__hsfp';

/** localStorage entry (`of_attr_hutk`) for the visitor token a handoff carried. */
const HUBSPOT_UTK_STORAGE_PARAM = 'hutk';

/** localStorage entry (`of_attr_download_id`) for the id an "Open the app" link brought. */
const DOWNLOAD_ID_STORAGE_PARAM = 'download_id';

/** A download id as the gateway records it: a lowercase UUID. Anything else it ignores. */
const DOWNLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A HubSpot visitor token: 32 hex characters, the `hubspotutk` cookie value. */
const HUBSPOT_UTK_PATTERN = /^[0-9a-f]{32}$/i;

/** The visit's URL parameters on the marketing site's handoff, and its localStorage entries. */
const VISIT_REFERRER_PARAM = 'referrer';
const VISIT_LANDING_URL_PARAM = 'landing_url';

/** The backend's cap on a referrer or landing page. A longer one is dropped, not cut: half a path names no page. */
const VISIT_URL_MAX_LENGTH = 2048;

/**
 * Sign-in pages of the SSO providers. A page load whose referrer is one of them is the end of a
 * sign-in, not a visit, and `accounts.google.com` would read as organic search.
 */
const SIGN_IN_HOSTS = new Set([
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
]);

const STORAGE_PREFIX = 'of_attr_';

/**
 * How long a captured landing-page parameter stays usable. Matches the 90-day referral-cookie
 * window; enforced on read because localStorage entries never expire on their own.
 */
const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** What one localStorage entry holds: the parameter value plus its capture time, so expiry is per parameter. */
interface StoredAttributionEntry {
  v: string;
  t: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readUrlParam(name: string): string | undefined {
  if (!isBrowser()) return undefined;
  try {
    return new URLSearchParams(window.location.search).get(name)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function readStored(param: string): string | undefined {
  if (!isBrowser()) return undefined;
  const key = STORAGE_PREFIX + param;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    let entry: Partial<StoredAttributionEntry> | undefined;
    try {
      entry = JSON.parse(raw);
    } catch {
      // A stored entry that is not valid JSON was written by an older format or corrupted by hand — `entry` stays undefined and the validity check below discards it.
    }
    if (
      !entry ||
      typeof entry.v !== 'string' ||
      typeof entry.t !== 'number' ||
      Date.now() - entry.t > ATTRIBUTION_TTL_MS
    ) {
      // Expired or unreadable — drop it so the next visit's parameters count as a first touch.
      window.localStorage.removeItem(key);
      return undefined;
    }
    return entry.v.trim() || undefined;
  } catch {
    return undefined;
  }
}

function writeStored(param: string, value: string): void {
  if (!isBrowser()) return;
  try {
    const entry: StoredAttributionEntry = { v: value, t: Date.now() };
    window.localStorage.setItem(STORAGE_PREFIX + param, JSON.stringify(entry));
  } catch {
    // Attribution is analytics: losing it to a full or blocked localStorage must not fail the registration the user is in the middle of.
  }
}

/**
 * The visitor token inside a `__hstc` value —
 * `<domain hash>.<utk>.<first visit>.<previous visit>.<this visit>.<visit count>` — which is
 * the same string HubSpot keeps in the `hubspotutk` cookie. `undefined` for anything that does
 * not carry a well-formed token in that slot, so a hand-edited parameter never reaches the
 * form submission.
 */
export function hubspotUtkFromHstc(hstc: string | null | undefined): string | undefined {
  const utk = hstc?.trim().split('.')[1];
  return utk && HUBSPOT_UTK_PATTERN.test(utk) ? utk : undefined;
}

/**
 * The visitor token on the current URL when it is a HubSpot cross-domain handoff. Same
 * acceptance rule as the GTM container's first-visit seed — a well-formed `__hstc` next to a
 * `__hsfp` — so both paths agree on which URLs count.
 */
function readHubspotHandoffUtk(): string | undefined {
  const utk = hubspotUtkFromHstc(readUrlParam(HUBSPOT_HSTC_PARAM));
  return utk && readUrlParam(HUBSPOT_HSFP_PARAM) ? utk : undefined;
}

interface Visit {
  referrer?: string;
  landingUrl?: string;
}

/** A URL reduced to `origin + pathname`; `undefined` for anything that is not an http(s) page or is over the cap. */
function toVisitUrl(raw: string | null | undefined): string | undefined {
  const page = raw ? sanitizeLandingUrl(raw) : undefined;
  return page && page.length <= VISIT_URL_MAX_LENGTH ? page : undefined;
}

/** Ours: this site's own registrable domain (`openframe.ai` from `auth.openframe.ai`), or another platform we run. */
function isOwnHost(host: string): boolean {
  const here = window.location.hostname.toLowerCase();
  const base = toRegistrableBaseDomain(host);
  return (
    host === here ||
    (base !== undefined && base === toRegistrableBaseDomain(here)) ||
    getPlatformByHostname(host) !== null
  );
}

/**
 * Whether a referrer means the visitor did not arrive from outside: they came from one of our
 * own sites (the original source is that site's to hand over) or back from a sign-in page.
 */
function isInsideReferrer(referrer: string): boolean {
  const host = hostOf(referrer);
  return host !== null && (SIGN_IN_HOSTS.has(host) || isOwnHost(host));
}

/** The document's referrer, `undefined` when there is none or it cannot be read. */
function readDocumentReferrer(): string | undefined {
  try {
    return document.referrer || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The visit this page load stands for, or `undefined` when it is not an arrival (see the header).
 * The marketing site's handoff comes first: it saw the real first page and the referrer before
 * it. Otherwise this page is the landing page and the document's referrer is the source, with
 * no referrer at all meaning a direct visit.
 */
function readVisit(): Visit | undefined {
  if (!isBrowser() || isAppShell()) return undefined;

  const handoffReferrer = toVisitUrl(readUrlParam(VISIT_REFERRER_PARAM));
  const handoffLandingUrl = toVisitUrl(readUrlParam(VISIT_LANDING_URL_PARAM));
  if (handoffReferrer || handoffLandingUrl) {
    return {
      referrer: handoffReferrer && !isInsideReferrer(handoffReferrer) ? handoffReferrer : undefined,
      landingUrl: handoffLandingUrl,
    };
  }

  const referrer = readDocumentReferrer();
  if (referrer && isInsideReferrer(referrer)) return undefined;
  return { referrer: toVisitUrl(referrer), landingUrl: toVisitUrl(window.location.href) };
}

/** The stored visit; `undefined` when none is stored or it has expired. */
function readStoredVisit(): Visit | undefined {
  const referrer = readStored(VISIT_REFERRER_PARAM);
  const landingUrl = readStored(VISIT_LANDING_URL_PARAM);
  return referrer || landingUrl ? { referrer, landingUrl } : undefined;
}

/**
 * The visit that counts: the stored one, unless it was direct and this page load arrived from a
 * source. A direct visit says nothing about the channel, so the first arrival that names one
 * replaces it whole, so a landing page is never paired with another visit's referrer.
 */
function chooseVisit(stored: Visit | undefined, arrival: Visit | undefined): Visit | undefined {
  if (!stored) return arrival;
  return !stored.referrer && arrival?.referrer ? arrival : stored;
}

function writeStoredVisitField(param: string, value: string | undefined): void {
  if (value) {
    writeStored(param, value);
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + param);
  } catch {
    // Same as writeStored: a blocked localStorage only costs the attribution.
  }
}

/** Store the visit this page load stands for when it is the one that counts (see `chooseVisit`). */
function captureVisit(): void {
  const stored = readStoredVisit();
  if (stored?.referrer) return;
  const visit = chooseVisit(stored, readVisit());
  if (!visit || visit === stored) return;
  writeStoredVisitField(VISIT_REFERRER_PARAM, visit.referrer);
  writeStoredVisitField(VISIT_LANDING_URL_PARAM, visit.landingUrl);
}

/**
 * Read every known attribution parameter out of the current URL and persist it for up to
 * 90 days. Safe to call on every page load: an existing unexpired value is never overwritten,
 * so the *first* touch wins — that is the ad click that brought the visitor, not whatever
 * internal navigation they made afterwards. An expired entry reads as absent, so the next
 * visit that carries the parameter starts a fresh 90-day window. The visit (referrer and
 * landing page) follows the same first-touch rule as one pair, a direct one giving way to the
 * first referred arrival. The HubSpot handoff is the one last-touch entry (see the header).
 */
export function captureAttributionFromUrl(): void {
  if (!isBrowser()) return;

  for (const param of Object.keys(URL_PARAM_TO_FIELD)) {
    const value = readUrlParam(param);
    if (value && !readStored(param)) {
      writeStored(param, value);
    }
  }

  // Last touch: the latest handoff is the identity HubSpot would be on. Usually idempotent — the
  // marketing site's token is stable for a browser, so a repeat handoff rewrites the same value
  // and only refreshes its 90 days.
  const handoffUtk = readHubspotHandoffUtk();
  if (handoffUtk) writeStored(HUBSPOT_UTK_STORAGE_PARAM, handoffUtk);

  captureVisit();

  // `?ref=` is deliberately NOT part of that loop: it is cookie-backed, cross-subdomain and
  // last-touch, none of which localStorage first-touch capture can express. Usually a no-op —
  // the cookie normally arrives from the marketing site, and an unchanged one is left alone.
  captureReferralFromUrl();
}

/**
 * Keep the id the desktop shell handed over from an "Open the app" link, for the signup. The
 * latest one wins (see the header); one that is not a UUID is dropped, as the gateway would.
 */
export function storeDownloadId(id: string): void {
  const normalized = id.trim().toLowerCase();
  if (DOWNLOAD_ID_PATTERN.test(normalized)) writeStored(DOWNLOAD_ID_STORAGE_PARAM, normalized);
}

/** RFC4122 id, falling back to a random string where `crypto.randomUUID` is unavailable. */
function generateEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // `crypto.randomUUID` is missing on insecure origins and throws in a few older engines; the timestamp-and-random fallback below is the point of the try.
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Publish the event id to the GTM dataLayer. The Meta pixel on openframe.ai is injected
 * through GTM rather than by this app, so a Meta "Lead" tag in the container can read
 * `metaEventId` and pass it as its own `eventID` — that shared value is what makes Meta
 * collapse the pixel event and our server event into one conversion instead of two.
 */
function publishEventIdToDataLayer(eventId: string): void {
  if (!isBrowser()) return;
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: 'openframe_registration', metaEventId: eventId });
  } catch {
    // The dataLayer belongs to GTM, which may not be loaded (or may be blocked outright). A missing analytics push is not worth surfacing.
  }
}

/**
 * Enforce the "omit, never send empty" contract: drop blank fields, return `undefined` when
 * nothing survives. Both registration flows (password body and SSO query params) run their
 * attribution through this, so an explicit caller-supplied object gets the exact same
 * treatment as a collector-produced one.
 */
export function normalizeAttribution(attribution: Touchpoint): Touchpoint | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(attribution).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
  ) as Touchpoint;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Serialize an attribution set into query parameters for the SSO signup-continue URL. Blank values
 * are skipped — same "omit, never send empty" contract as the password-flow body. Kept here (not in
 * the API client) so the field set that rides the SSO redirect provably matches what
 * `collectRegistrationAttribution` produces.
 *
 * Keys are BARE, matching the `@ModelAttribute Touchpoint` the endpoint binds
 * directly. Prefixing them (as a wrapper DTO would need) does not error — the params simply never
 * bind and the attribution is lost silently.
 */
export function appendAttributionQueryParams(params: URLSearchParams, attribution: Touchpoint): void {
  for (const [field, value] of Object.entries(normalizeAttribution(attribution) ?? {})) {
    params.append(field, value);
  }
}

/**
 * Build the attribution payload for a registration request. Cookies are read live, URL
 * signals come from what was captured on the landing page, and a fresh `eventId` is minted
 * for this submission. Empty values are dropped so the backend never receives a blank
 * property. Returns `undefined` only when nothing at all was captured.
 */
export function collectRegistrationAttribution(): Touchpoint | undefined {
  if (!isBrowser()) return undefined;

  const eventId = generateEventId();
  publishEventIdToDataLayer(eventId);

  const raw: Touchpoint = {
    fbc: readCookie('_fbc'),
    fbp: readCookie('_fbp'),
    rdtUuid: readCookie('_rdt_uuid'),
    // The marketing site's token first, the local cookie only for a visitor who never came
    // through the handoff (see the header). The live URL sits between them for the same reason
    // as the ad parameters below: a handoff straight to the signup page, submitted before the
    // capture effect ran.
    hutk: readStored(HUBSPOT_UTK_STORAGE_PARAM) ?? readHubspotHandoffUtk() ?? readCookie('hubspotutk'),
    eventId,
    // Cookie first — it is the one signal that can predate this visit entirely. The live URL is
    // the fallback for a partner link pointing straight at the signup page, submitted before the
    // capture effect got to write the cookie.
    ref: readReferralCode() ?? sanitizeReferralCode(readUrlParam(REFERRAL_URL_PARAM)),
    downloadId: readStored(DOWNLOAD_ID_STORAGE_PARAM),
  };

  for (const [param, field] of Object.entries(URL_PARAM_TO_FIELD)) {
    // First touch wins: prefer the value captured on the landing page over whatever is on the
    // current URL, matching the backend's first-touch enrichment. `captureAttributionFromUrl`
    // has already run (root layout, on mount), so a landing param is stored by submit time; the
    // live URL is only the fallback for a visitor who lands straight on the signup page.
    raw[field] = readStored(param) ?? readUrlParam(param);
  }

  // This page load's own arrival counts too, for the same direct-landing reason.
  const visit = chooseVisit(readStoredVisit(), readVisit());
  raw.referrer = visit?.referrer;
  raw.landingUrl = visit?.landingUrl;

  return normalizeAttribution(raw);
}
