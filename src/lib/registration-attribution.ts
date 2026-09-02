import { readCookie } from './cookies';
import { captureReferralFromUrl, REFERRAL_URL_PARAM, readReferralCode, sanitizeReferralCode } from './referral-cookie';

/**
 * Marketing-attribution signals collected at registration time, shaped to match the backend
 * `RegistrationAttribution` DTO — field names here must stay in sync with that Java class.
 *
 * Three different lifetimes are at play, which is why this file has both a capture step and a
 * collect step:
 *
 * - **Cookies** (`_fbc`, `_fbp`) are written by the Meta pixel. They are not HttpOnly, they
 *   live on the openframe.ai origin, and they are still there at submit time — so they are
 *   read directly when the form is submitted, and the register request does not need to be
 *   same-domain.
 *
 * - **URL parameters** (`fbclid`, `gclid`, `rdt_cid`, `li_fat_id`, `utm_*`) exist only in the
 *   address bar of the *landing* page. A visitor who lands on `/` and then navigates to
 *   `/auth` has already lost them, so they are captured into localStorage on first load
 *   (see `captureAttributionFromUrl`, mounted app-wide) and read back at submit. Each entry
 *   carries its capture timestamp and expires after 90 days — enforced in code, because
 *   localStorage itself never expires — so the ad click survives the tab being closed and a
 *   return visit days later, without attributing signups to clicks from another quarter.
 *   Known limitation: Safari ITP caps script-writable storage at ~7 days; accepted as-is.
 *
 * - **The partner referral** (`?ref=`) is different still. It is clicked on the marketing site
 *   (`openframe.ai`) and redeemed on the signup app (`auth.openframe.ai`) — localStorage is
 *   origin-scoped, so it cannot make that hop. It gets its own 90-day cookie on the shared
 *   base domain; `referral-cookie.ts` owns that mechanism and the last-touch policy behind it.
 */

/** Backend DTO shape. Every field optional; absent means "never send this property". */
export interface RegistrationAttribution {
  /** Full `_fbc` cookie value — never truncate. */
  fbc?: string;
  /** `fbclid` from the landing URL; the backend uses it only when `_fbc` is absent. */
  fbclid?: string;
  /** `_fbp` cookie value — the Meta browser id, sent to Meta as `fbp`. */
  fbp?: string;
  /** HubSpot visitor cookie (`hubspotutk`). The backend puts it in the registration form
   * submission, which is what gives the contact its real traffic source. */
  hutk?: string;
  /** Google click id. */
  gclid?: string;
  /** Reddit click id. */
  rdtCid?: string;
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
}

/**
 * URL parameter -> DTO field. Each entry also becomes a localStorage key (prefixed), so
 * adding a network here is a one-line change that flows through capture, storage and submit.
 */
const URL_PARAM_TO_FIELD: Record<string, keyof RegistrationAttribution> = {
  fbclid: 'fbclid',
  gclid: 'gclid',
  rdt_cid: 'rdtCid',
  li_fat_id: 'liFatId',
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
};

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
 * Read every known attribution parameter out of the current URL and persist it for up to
 * 90 days. Safe to call on every page load: an existing unexpired value is never overwritten,
 * so the *first* touch wins — that is the ad click that brought the visitor, not whatever
 * internal navigation they made afterwards. An expired entry reads as absent, so the next
 * visit that carries the parameter starts a fresh 90-day window.
 */
export function captureAttributionFromUrl(): void {
  if (!isBrowser()) return;

  for (const param of Object.keys(URL_PARAM_TO_FIELD)) {
    const value = readUrlParam(param);
    if (value && !readStored(param)) {
      writeStored(param, value);
    }
  }

  // `?ref=` is deliberately NOT part of that loop: it is cookie-backed, cross-subdomain and
  // last-touch, none of which localStorage first-touch capture can express. Usually a no-op —
  // the cookie normally arrives from the marketing site, and an unchanged one is left alone.
  captureReferralFromUrl();
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
export function normalizeAttribution(attribution: RegistrationAttribution): RegistrationAttribution | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(attribution).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
  ) as RegistrationAttribution;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Serialize an attribution set into `attribution.<field>` query parameters for the SSO
 * registration start URL. Nested `attribution.*` keys are what Spring's @ModelAttribute
 * binds on the backend. Blank values are skipped — same "omit, never send empty" contract
 * as the password-flow body. Kept here (not in the API client) so the field set that rides
 * the SSO redirect provably matches what `collectRegistrationAttribution` produces.
 */
export function appendAttributionQueryParams(params: URLSearchParams, attribution: RegistrationAttribution): void {
  for (const [field, value] of Object.entries(normalizeAttribution(attribution) ?? {})) {
    params.append(`attribution.${field}`, value);
  }
}

/**
 * Build the attribution payload for a registration request. Cookies are read live, URL
 * signals come from what was captured on the landing page, and a fresh `eventId` is minted
 * for this submission. Empty values are dropped so the backend never receives a blank
 * property. Returns `undefined` only when nothing at all was captured.
 */
export function collectRegistrationAttribution(): RegistrationAttribution | undefined {
  if (!isBrowser()) return undefined;

  const eventId = generateEventId();
  publishEventIdToDataLayer(eventId);

  const raw: RegistrationAttribution = {
    fbc: readCookie('_fbc'),
    fbp: readCookie('_fbp'),
    hutk: readCookie('hubspotutk'),
    eventId,
    // Cookie first — it is the one signal that can predate this visit entirely. The live URL is
    // the fallback for a partner link pointing straight at the signup page, submitted before the
    // capture effect got to write the cookie.
    ref: readReferralCode() ?? sanitizeReferralCode(readUrlParam(REFERRAL_URL_PARAM)),
  };

  for (const [param, field] of Object.entries(URL_PARAM_TO_FIELD)) {
    // First touch wins: prefer the value captured on the landing page over whatever is on the
    // current URL, matching the backend's first-touch enrichment. `captureAttributionFromUrl`
    // has already run (root layout, on mount), so a landing param is stored by submit time; the
    // live URL is only the fallback for a visitor who lands straight on the signup page.
    raw[field] = readStored(param) ?? readUrlParam(param);
  }

  return normalizeAttribution(raw);
}
