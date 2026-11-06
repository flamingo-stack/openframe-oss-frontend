import { readCookie } from './cookies';
import { isAppShell } from './platform';
import { captureReferralFromUrl, REFERRAL_URL_PARAM, readReferralCode, sanitizeReferralCode } from './referral-cookie';
import {
  CLICK_PLATFORMS,
  type ClickPlatform,
  captureVisit,
  parseFbc,
  pickFbc,
  readVisitAttribution,
  type Visit,
  VISIT_FIELDS,
  type VisitField,
} from './visit-attribution';

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
 *   not need to be same-domain. The marketing site's links also carry its own `_fbc` as `fbc`:
 *   it names the ad click with the time the visitor clicked it, while the gateway and the pixel
 *   here mint a cookie only when the handoff lands, from whatever `fbclid` it carries. It is kept
 *   like the HubSpot token below, and the one sent is the one naming the latest click (`pickFbc`).
 *
 * - **The visits and clicks** (`firstVisit`, `lastVisit`, `latestClicks`): the URL parameters
 *   (`fbclid`, `gclid`, `gbraid`, `wbraid`, `rdt_cid`, `li_fat_id`, `utm_*`) and the visit's
 *   referrer and landing page exist only on the page load the visitor *arrived* on. A visitor who
 *   lands on `/` and then navigates to `/auth` has already lost them, so they are captured into
 *   localStorage on every page load (`captureAttributionFromUrl`, mounted app-wide) and read back
 *   at submit. `visit-attribution.ts` keeps them, the same module flamingo.run runs byte for byte,
 *   and its header has the rules: what an arrival is, the first and the latest visit, each ad
 *   platform's latest click, the handoff the marketing sites send, the 90-day expiry. Inside the
 *   app shells there is no referrer and the page is a bundle URL, so no referrer or landing page
 *   is recorded there.
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
  /** Full `_fbc` value, this site's cookie or the marketing site's (`pickFbc`) — never truncate. */
  fbc?: string;
  /** `_fbp` cookie value — the Meta browser id, sent to Meta as `fbp`. */
  fbp?: string;
  /** HubSpot visitor token (utk): the marketing site's when the visitor came from there, else
   * the local `hubspotutk` cookie (see the header). The backend puts it in the registration
   * form submission, which is what gives the contact its real traffic source. */
  hutk?: string;
  /** `_rdt_uuid` cookie value: the Reddit pixel's browser id, sent to Reddit with the signup. */
  rdtUuid?: string;
  /** Shared id for pixel/server deduplication; generated at form submit. */
  eventId?: string;
  /** Partner referral code from the `of_ref` cookie — see `referral-cookie.ts`. */
  ref?: string;
  /** The id the desktop installer was downloaded with, handed to the app by its "Open the app" link. */
  downloadId?: string;
  /** The desktop app's "How did you hear about us?" answer: `search`, `ai`, `producthunt`,
   * `social_ad`, `newsletter`, `friend`, `partner` or `other`. */
  heardFrom?: string;
  /** The text typed beside the `other` answer. */
  heardFromOther?: string;
  /** The first arrival (see `visit-attribution.ts`). */
  firstVisit?: TouchpointVisit;
  /** The latest arrival. */
  lastVisit?: TouchpointVisit;
  /** Each ad platform's latest click id, with the time it was first seen. */
  latestClicks?: TouchpointClicks;
}

/** One visit as the backend DTO names it. */
export interface TouchpointVisit {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  rdtCid?: string;
  liFatId?: string;
  /** The page the visitor came from, `origin + pathname` (see the header). The backend reads the
   * channel from its host: a search engine, an AI assistant, or another site. */
  referrer?: string;
  /** The first page of the visit, `origin + pathname` (see the header). */
  landingUrl?: string;
  /** Epoch milliseconds. */
  landedAt?: number;
}

/** Each platform's latest click as the backend DTO names it; `clickedAt` in epoch milliseconds. */
export interface TouchpointClicks {
  meta?: { fbclid?: string; clickedAt?: number };
  google?: { gclid?: string; clickedAt?: number };
  reddit?: { rdtCid?: string; clickedAt?: number };
  linkedin?: { liFatId?: string; clickedAt?: number };
}

/** A visit's field as the link names it -> as the backend DTO does. */
const VISIT_FIELD_TO_DTO: Record<VisitField, Exclude<keyof TouchpointVisit, 'landedAt'>> = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
  fbclid: 'fbclid',
  gclid: 'gclid',
  gbraid: 'gbraid',
  wbraid: 'wbraid',
  rdt_cid: 'rdtCid',
  li_fat_id: 'liFatId',
  referrer: 'referrer',
  landing_url: 'landingUrl',
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

/** The marketing site's `_fbc`, as its links carry it, and the localStorage entry (`of_attr_fbc`) it is kept in. */
const FBC_PARAM = 'fbc';

/** localStorage entry (`of_attr_download_id`) for the id an "Open the app" link brought. */
const DOWNLOAD_ID_STORAGE_PARAM = 'download_id';

/** A download id as the gateway records it: a lowercase UUID. Anything else it ignores. */
const DOWNLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A HubSpot visitor token: 32 hex characters, the `hubspotutk` cookie value. */
const HUBSPOT_UTK_PATTERN = /^[0-9a-f]{32}$/i;

const STORAGE_PREFIX = 'of_attr_';

/**
 * How long the stored HubSpot token and download id stay usable. Matches the 90-day referral-cookie
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

/** The marketing site's `_fbc` this page load carries, when it is well-formed. */
function readHandoffFbc(): string | undefined {
  const fbc = readUrlParam(FBC_PARAM);
  return parseFbc(fbc) ? fbc : undefined;
}

/** The visits and clicks of this page load, recorded (see `visit-attribution.ts`). Safe to call any number of times. */
function captureVisitOfPage(): void {
  captureVisit({ visitUrls: !isAppShell() });
}

/**
 * Capture this page load's attribution: its visit and ad clicks (see `visit-attribution.ts`),
 * the HubSpot handoff and the partner referral. Safe to call on every page load and any number
 * of times in one.
 */
export function captureAttributionFromUrl(): void {
  if (!isBrowser()) return;

  captureVisitOfPage();

  // Last touch: the latest handoff is the identity HubSpot would be on. Usually idempotent — the
  // marketing site's token is stable for a browser, so a repeat handoff rewrites the same value
  // and only refreshes its 90 days.
  const handoffUtk = readHubspotHandoffUtk();
  if (handoffUtk) writeStored(HUBSPOT_UTK_STORAGE_PARAM, handoffUtk);

  // The same rule as at submit, so a later handoff of the same click keeps the earlier time.
  const stored = readStored(FBC_PARAM);
  const fbc = pickFbc([stored, readHandoffFbc()], readVisitAttribution());
  if (fbc && fbc !== stored) writeStored(FBC_PARAM, fbc);

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
  return normalizeValue(attribution) as Touchpoint | undefined;
}

/** A non-blank string, a finite number, or an object of those (nested ones too); `undefined` for anything else. */
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') return value.trim().length > 0 ? value : undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value)
    .map(([key, nested]) => [key, normalizeValue(nested)] as const)
    .filter(([, nested]) => nested !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Serialize an attribution set into query parameters for the SSO signup-continue URL. Blank values
 * are skipped — same "omit, never send empty" contract as the password-flow body. Kept here (not in
 * the API client) so the field set that rides the SSO redirect provably matches what
 * `collectRegistrationAttribution` produces.
 *
 * Keys are BARE, matching the `@ModelAttribute Touchpoint` the endpoint binds
 * directly. Prefixing them (as a wrapper DTO would need) does not error — the params simply never
 * bind and the attribution is lost silently. A nested field rides with dots
 * (`firstVisit.utmSource`, `latestClicks.meta.clickedAt`), which is how Spring binds it.
 */
export function appendAttributionQueryParams(params: URLSearchParams, attribution: Touchpoint): void {
  appendFlattened(params, '', normalizeAttribution(attribution));
}

function appendFlattened(params: URLSearchParams, prefix: string, value: unknown): void {
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value))
      appendFlattened(params, prefix ? `${prefix}.${key}` : key, nested);
  } else if (prefix && value !== undefined) {
    params.append(prefix, String(value));
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

  return normalizeAttribution({ ...readTouchpoint(), eventId });
}

/**
 * The same attribution for a request that is not a registration (the "Send me download link"
 * page): every signal, without the `eventId`, which exists to pair the registration with Meta's
 * pixel event and is published to the dataLayer as one. Returns `undefined` when nothing at all
 * was captured.
 */
export function collectTouchpoint(): Touchpoint | undefined {
  if (!isBrowser()) return undefined;
  return normalizeAttribution(readTouchpoint());
}

/** A visit's fields as the backend DTO names them, without its time. */
function toTouchpointFields(visit: Visit | undefined): Omit<TouchpointVisit, 'landedAt'> {
  const dto: Omit<TouchpointVisit, 'landedAt'> = {};
  for (const field of VISIT_FIELDS) dto[VISIT_FIELD_TO_DTO[field]] = visit?.fields[field];
  return dto;
}

function toTouchpointVisit(visit: Visit | undefined): TouchpointVisit | undefined {
  return visit ? { ...toTouchpointFields(visit), landedAt: visit.landedAt } : undefined;
}

/** Every attribution signal as it reads right now, blanks included: the two collectors above normalize it. */
function readTouchpoint(): Touchpoint {
  // This page load counts too: a visitor who lands straight on the signup page can submit before
  // the capture effect has run.
  captureVisitOfPage();
  const attribution = readVisitAttribution();
  const { firstVisit, lastVisit, latestClicks } = attribution;

  const clicks: TouchpointClicks = {};
  for (const platform of Object.keys(CLICK_PLATFORMS) as ClickPlatform[]) {
    const click = latestClicks[platform];
    if (!click) continue;
    const id = VISIT_FIELD_TO_DTO[CLICK_PLATFORMS[platform]];
    clicks[platform] = { [id]: click.id, clickedAt: click.clickedAt };
  }

  return {
    // The live URL as for the HubSpot token: a handoff submitted before the capture effect ran.
    fbc: pickFbc([readCookie('_fbc'), readStored(FBC_PARAM), readHandoffFbc()], attribution),
    fbp: readCookie('_fbp'),
    rdtUuid: readCookie('_rdt_uuid'),
    // The marketing site's token first, the local cookie only for a visitor who never came
    // through the handoff (see the header). The live URL sits between them: a handoff straight
    // to the signup page, submitted before the capture effect ran.
    hutk: readStored(HUBSPOT_UTK_STORAGE_PARAM) ?? readHubspotHandoffUtk() ?? readCookie('hubspotutk'),
    // Cookie first — it is the one signal that can predate this visit entirely. The live URL is
    // the fallback for a partner link pointing straight at the signup page, submitted before the
    // capture effect got to write the cookie.
    ref: readReferralCode() ?? sanitizeReferralCode(readUrlParam(REFERRAL_URL_PARAM)),
    downloadId: readStored(DOWNLOAD_ID_STORAGE_PARAM),
    firstVisit: toTouchpointVisit(firstVisit),
    lastVisit: toTouchpointVisit(lastVisit),
    latestClicks: clicks,
  };
}
