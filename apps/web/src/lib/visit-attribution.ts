import {
  getPlatformByHostname,
  hostOf,
  toRegistrableBaseDomain,
} from '@flamingo-stack/openframe-frontend-core/platform-domains';
import { sanitizeLandingUrl } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Where a visitor came from, kept in the browser until the signup or the download reads it: the
 * first visit, the latest visit and each ad platform's latest click.
 *
 * The same file lives in both frontends that keep it, byte for byte: multi-platform-hub
 * (`lib/analytics/visit-attribution.ts`, flamingo.run and the other marketing sites) and
 * openframe-oss-frontend (`apps/web/src/lib/visit-attribution.ts`, the signup app). Each origin
 * keeps its own copy of the data, under the same localStorage keys, and the links between our
 * sites carry it across. Change it in both.
 *
 * - **An arrival** is a page load that names a source: its URL carries UTM tags or a click id,
 *   or its referrer is another site (not one of ours, not a sign-in page). A page load with
 *   neither is a direct visit, kept only while nothing better is stored. Only the page load
 *   itself has a referrer: a later client-side navigation in it came from this site, so it is an
 *   arrival only when its own URL carries a source.
 * - **A visit** is one arrival, whole: its UTM tags, click ids, referrer, landing page
 *   (`origin + pathname`, `sanitizeLandingUrl`: a raw URL can carry tokens) and time. Two arrivals
 *   are never mixed in one visit. The first visit is saved once and replaced only while it is a
 *   direct one; the latest visit is replaced by every arrival.
 * - **A click** is a platform's click id with the time it was first seen: Meta's `fbclid`,
 *   Google's `gclid`, Reddit's `rdt_cid`, LinkedIn's `li_fat_id`. A different id of the same
 *   platform replaces it. Google's `gbraid` and `wbraid` stay in the visits only. Meta's click
 *   cookie, `_fbc`, names a click too, with the time it was made (`parseFbc`, the backend's
 *   format), and rides the links beside the visits as `fbc`. The one sent names the latest click
 *   (`pickFbc`), each click dated by the earliest time this browser knows it by: the gateway and
 *   the pixel mint `_fbc` from any `fbclid` on a link, dated by the page load, and a link's flat
 *   parameters carry the first visit's.
 * - **A handoff** is a link from another of our sites carrying its visits and clicks as
 *   `first_visit.*`, `last_visit.*` and `latest_clicks.*` parameters. It is not an arrival: it is
 *   merged with what is stored by time (the older first visit, the newer latest visit, the newer
 *   click), an arrival outranking a direct visit either way, and its flat parameters are ignored.
 *   A link with only the flat parameters is an older site's handoff and counts as an arrival, its
 *   `referrer` and `landing_url` being the visit the sender saw.
 * - **Expiry**: every visit and click expires 90 days after its time, enforced on read because
 *   localStorage never expires on its own. Known limitation: Safari ITP caps script-writable
 *   storage at ~7 days; accepted as-is.
 * - **Storage before this format** was one entry per parameter (`of_attr_utm_source`, …). Such
 *   entries become both visits, with the earliest of their times, and their click ids each
 *   platform's click, with their own; then they are removed.
 */

/** A visit's source parameters, as the link names them. */
export const VISIT_SOURCE_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'rdt_cid',
  'li_fat_id',
] as const;

/** Every field of a visit, as the link names it. */
export const VISIT_FIELDS = [...VISIT_SOURCE_PARAMS, 'referrer', 'landing_url'] as const;

export type VisitField = (typeof VISIT_FIELDS)[number];

export type VisitFields = Partial<Record<VisitField, string>>;

export interface Visit {
  fields: VisitFields;
  /** Epoch milliseconds. */
  landedAt: number;
}

/** Each platform's click id parameter. */
export const CLICK_PLATFORMS = { meta: 'fbclid', google: 'gclid', reddit: 'rdt_cid', linkedin: 'li_fat_id' } as const;

export type ClickPlatform = keyof typeof CLICK_PLATFORMS;

export interface Click {
  id: string;
  /** Epoch milliseconds. */
  clickedAt: number;
}

/** Meta's click cookie, `fb.<subdomain index>.<click time>.<fbclid>`, as the backend accepts it. */
const FBC_PATTERN = /^fb\.\d+\.(\d{1,18})\.([A-Za-z0-9._-]+)$/;
const FBC_MAX_LENGTH = 512;

/** The click a `_fbc` value names; `undefined` for one the backend would refuse. */
export function parseFbc(value: string | undefined): Click | undefined {
  const match = value && value.length <= FBC_MAX_LENGTH ? FBC_PATTERN.exec(value) : null;
  return match ? { id: match[2], clickedAt: Number(match[1]) } : undefined;
}

export interface VisitAttribution {
  firstVisit?: Visit;
  lastVisit?: Visit;
  latestClicks: Partial<Record<ClickPlatform, Click>>;
}

/**
 * Of these `_fbc` values, the one that names the latest Meta click, the earliest made of that
 * click; `undefined` when none names it (the backend then builds one from `latestClicks.meta`).
 */
export function pickFbc(values: readonly (string | undefined)[], attribution: VisitAttribution): string | undefined {
  const seenAt = new Map<string, number>();
  const see = (id: string | undefined, at: number | undefined) => {
    if (id && at !== undefined) seenAt.set(id, Math.min(seenAt.get(id) ?? at, at));
  };
  const { firstVisit, lastVisit, latestClicks } = attribution;
  see(firstVisit?.fields.fbclid, firstVisit?.landedAt);
  see(lastVisit?.fields.fbclid, lastVisit?.landedAt);
  see(latestClicks.meta?.id, latestClicks.meta?.clickedAt);
  const named = values.flatMap(value => {
    const click = parseFbc(value);
    return value && click ? [{ value, click }] : [];
  });
  for (const { click } of named) see(click.id, click.clickedAt);
  const latest = [...seenAt].sort((a, b) => b[1] - a[1])[0]?.[0];
  return named.filter(({ click }) => click.id === latest).sort((a, b) => a.click.clickedAt - b.click.clickedAt)[0]
    ?.value;
}

const STORAGE_PREFIX = 'of_attr_';
const FIRST_VISIT_KEY = 'first_visit';
const LAST_VISIT_KEY = 'last_visit';
const CLICK_KEY_PREFIX = 'click_';

/** The handoff's parameter prefixes; `latest_clicks.<platform>.<click id parameter>` and `.clicked_at`. */
const FIRST_VISIT_PARAM = 'first_visit';
const LAST_VISIT_PARAM = 'last_visit';
const LATEST_CLICKS_PARAM = 'latest_clicks';
const LANDED_AT_FIELD = 'landed_at';
const CLICKED_AT_FIELD = 'clicked_at';

const VISIT_URL_FIELDS: ReadonlySet<VisitField> = new Set(['referrer', 'landing_url']);

/** The backend's cap on a referrer or landing page. A longer one is dropped, not cut: half a path names no page. */
const VISIT_URL_MAX_LENGTH = 2048;

/** 90 days, the referral cookie's window too. */
const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

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

/** What one localStorage entry holds: the value and its time, so expiry is per entry. */
interface StoredEntry {
  v: unknown;
  t: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function isLive(time: number): boolean {
  return Number.isFinite(time) && Date.now() - time <= ATTRIBUTION_TTL_MS;
}

function readEntry(name: string): StoredEntry | undefined {
  const key = STORAGE_PREFIX + name;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    let entry: Partial<StoredEntry> | null | undefined;
    try {
      entry = JSON.parse(raw);
    } catch {
      // Not JSON: written by hand or corrupted. `entry` stays undefined and is dropped below.
    }
    if (!entry || typeof entry !== 'object' || typeof entry.t !== 'number' || !isLive(entry.t)) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    return { v: entry.v, t: entry.t };
  } catch {
    return undefined;
  }
}

function writeEntry(name: string, value: unknown, time: number): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify({ v: value, t: time }));
  } catch {
    // Attribution is analytics: a full or blocked localStorage only costs it.
  }
}

function removeEntry(name: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + name);
  } catch {
    // Same as writeEntry.
  }
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

/** Whether a referrer means the visitor did not arrive from outside: one of our sites, or back from a sign-in page. */
function isInsideReferrer(referrer: string): boolean {
  const host = hostOf(referrer);
  return host !== null && (SIGN_IN_HOSTS.has(host) || isOwnHost(host));
}

function readDocumentReferrer(): string | undefined {
  try {
    return document.referrer || undefined;
  } catch {
    return undefined;
  }
}

function cleanField(field: VisitField, raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  return VISIT_URL_FIELDS.has(field) ? toVisitUrl(raw) : raw.trim() || undefined;
}

/** A direct visit names no source: no UTM tag, no click id, no referrer. */
function isDirect(fields: VisitFields): boolean {
  return !fields.referrer && VISIT_SOURCE_PARAMS.every(param => !fields[param]);
}

function sameFields(a: VisitFields, b: VisitFields): boolean {
  return VISIT_FIELDS.every(field => a[field] === b[field]);
}

/** Whether `candidate` should replace `stored`: an arrival beats a direct visit, then the time decides. */
function outranks(candidate: Visit, stored: Visit, keep: 'older' | 'newer'): boolean {
  if (isDirect(candidate.fields) !== isDirect(stored.fields)) return isDirect(stored.fields);
  return keep === 'older' ? candidate.landedAt < stored.landedAt : candidate.landedAt > stored.landedAt;
}

function readStoredVisit(name: string): Visit | undefined {
  const entry = readEntry(name);
  if (!entry || !entry.v || typeof entry.v !== 'object') return undefined;
  const stored = entry.v as Record<string, unknown>;
  const fields: VisitFields = {};
  for (const field of VISIT_FIELDS) {
    const value = cleanField(field, stored[field]);
    if (value) fields[field] = value;
  }
  return { fields, landedAt: entry.t };
}

function writeVisit(name: string, visit: Visit): void {
  writeEntry(name, visit.fields, visit.landedAt);
}

function readStoredClick(platform: ClickPlatform): Click | undefined {
  const entry = readEntry(CLICK_KEY_PREFIX + platform);
  const id = typeof entry?.v === 'string' ? entry.v.trim() : '';
  return entry && id ? { id, clickedAt: entry.t } : undefined;
}

/** Keep `click` when it is newer than the stored one; the same id keeps the time it was first seen. */
function keepClick(platform: ClickPlatform, click: Click): void {
  const stored = readStoredClick(platform);
  const replaces =
    stored?.id === click.id ? click.clickedAt < stored.clickedAt : !stored || click.clickedAt > stored.clickedAt;
  if (replaces) writeEntry(CLICK_KEY_PREFIX + platform, click.id, click.clickedAt);
}

/** Turn entries in the format before this one into visits and clicks (see the header). */
function migrateLegacyEntries(): void {
  const fields: VisitFields = {};
  const clicks: [ClickPlatform, Click][] = [];
  let landedAt: number | undefined;
  for (const field of VISIT_FIELDS) {
    const entry = readEntry(field);
    if (!entry) continue;
    removeEntry(field);
    const value = cleanField(field, entry.v);
    if (!value) continue;
    fields[field] = value;
    landedAt = landedAt === undefined ? entry.t : Math.min(landedAt, entry.t);
    for (const [platform, param] of Object.entries(CLICK_PLATFORMS) as [ClickPlatform, string][]) {
      if (param === field) clicks.push([platform, { id: value, clickedAt: entry.t }]);
    }
  }
  if (landedAt === undefined) return;
  const visit = { fields, landedAt };
  if (!readStoredVisit(FIRST_VISIT_KEY)) writeVisit(FIRST_VISIT_KEY, visit);
  if (!readStoredVisit(LAST_VISIT_KEY)) writeVisit(LAST_VISIT_KEY, visit);
  for (const [platform, click] of clicks) keepClick(platform, click);
}

/** The stored visits and clicks, expired ones left out. */
export function readVisitAttribution(): VisitAttribution {
  const attribution: VisitAttribution = { latestClicks: {} };
  if (!isBrowser()) return attribution;
  migrateLegacyEntries();
  attribution.firstVisit = readStoredVisit(FIRST_VISIT_KEY);
  attribution.lastVisit = readStoredVisit(LAST_VISIT_KEY);
  for (const platform of Object.keys(CLICK_PLATFORMS) as ClickPlatform[]) {
    const click = readStoredClick(platform);
    if (click) attribution.latestClicks[platform] = click;
  }
  return attribution;
}

/** Whether a query parameter is one of a handoff's visits or clicks. */
export function isVisitHandoffParam(name: string): boolean {
  return [FIRST_VISIT_PARAM, LAST_VISIT_PARAM, LATEST_CLICKS_PARAM].some(prefix => name.startsWith(`${prefix}.`));
}

/** A handoff's time: epoch milliseconds, not in the future, not expired. */
function readQueryTime(raw: string | null): number | undefined {
  const digits = raw?.trim();
  if (!digits || !/^\d{1,16}$/.test(digits)) return undefined;
  const time = Math.min(Number(digits), Date.now());
  return isLive(time) ? time : undefined;
}

function readQueryVisit(params: URLSearchParams, prefix: string): Visit | undefined {
  const landedAt = readQueryTime(params.get(`${prefix}.${LANDED_AT_FIELD}`));
  if (landedAt === undefined) return undefined;
  const fields: VisitFields = {};
  for (const field of VISIT_FIELDS) {
    const value = cleanField(field, params.get(`${prefix}.${field}`));
    if (value && !(field === 'referrer' && isInsideReferrer(value))) fields[field] = value;
  }
  return Object.keys(fields).length > 0 ? { fields, landedAt } : undefined;
}

/** The visits and clicks a handoff link carries; `undefined` when the link is not one. */
function readHandoffQuery(params: URLSearchParams): VisitAttribution | undefined {
  if (![...params.keys()].some(isVisitHandoffParam)) return undefined;
  const attribution: VisitAttribution = {
    firstVisit: readQueryVisit(params, FIRST_VISIT_PARAM),
    lastVisit: readQueryVisit(params, LAST_VISIT_PARAM),
    latestClicks: {},
  };
  for (const [platform, param] of Object.entries(CLICK_PLATFORMS) as [ClickPlatform, string][]) {
    const prefix = `${LATEST_CLICKS_PARAM}.${platform}`;
    const id = params.get(`${prefix}.${param}`)?.trim();
    const clickedAt = readQueryTime(params.get(`${prefix}.${CLICKED_AT_FIELD}`));
    if (id && clickedAt !== undefined) attribution.latestClicks[platform] = { id, clickedAt };
  }
  return attribution;
}

/** `attribution` as a handoff's query parameters, in the link's names. */
export function toVisitHandoffParams(attribution: VisitAttribution): [string, string][] {
  const params: [string, string][] = [];
  for (const [prefix, visit] of [
    [FIRST_VISIT_PARAM, attribution.firstVisit],
    [LAST_VISIT_PARAM, attribution.lastVisit],
  ] as const) {
    if (!visit) continue;
    for (const field of VISIT_FIELDS) {
      const value = visit.fields[field];
      if (value) params.push([`${prefix}.${field}`, value]);
    }
    params.push([`${prefix}.${LANDED_AT_FIELD}`, String(visit.landedAt)]);
  }
  for (const [platform, param] of Object.entries(CLICK_PLATFORMS) as [ClickPlatform, string][]) {
    const click = attribution.latestClicks[platform];
    if (!click) continue;
    params.push([`${LATEST_CLICKS_PARAM}.${platform}.${param}`, click.id]);
    params.push([`${LATEST_CLICKS_PARAM}.${platform}.${CLICKED_AT_FIELD}`, String(click.clickedAt)]);
  }
  return params;
}

function mergeHandoff(handoff: VisitAttribution): void {
  const first = readStoredVisit(FIRST_VISIT_KEY);
  if (handoff.firstVisit && (!first || outranks(handoff.firstVisit, first, 'older'))) {
    writeVisit(FIRST_VISIT_KEY, handoff.firstVisit);
  }
  const last = readStoredVisit(LAST_VISIT_KEY);
  if (handoff.lastVisit && (!last || outranks(handoff.lastVisit, last, 'newer'))) {
    writeVisit(LAST_VISIT_KEY, handoff.lastVisit);
  }
  for (const [platform, click] of Object.entries(handoff.latestClicks) as [ClickPlatform, Click][]) {
    keepClick(platform, click);
  }
}

/**
 * The visit this page view stands for, or `undefined` when it is not an arrival and not a direct
 * visit either. An older site's handoff comes first: it saw the real landing page and the
 * referrer before it.
 */
function readArrival(params: URLSearchParams, pageLoad: boolean, visitUrls: boolean): VisitFields | undefined {
  const fields: VisitFields = {};
  for (const param of VISIT_SOURCE_PARAMS) {
    const value = params.get(param)?.trim();
    if (value) fields[param] = value;
  }
  const named = Object.keys(fields).length > 0;
  if (!visitUrls) return named ? fields : undefined;

  const handoffReferrer = toVisitUrl(params.get('referrer'));
  const handoffLandingUrl = toVisitUrl(params.get('landing_url'));
  if (handoffReferrer || handoffLandingUrl) {
    if (handoffReferrer && !isInsideReferrer(handoffReferrer)) fields.referrer = handoffReferrer;
    if (handoffLandingUrl) fields.landing_url = handoffLandingUrl;
    return fields;
  }

  const referrer = pageLoad ? readDocumentReferrer() : undefined;
  const inside = referrer !== undefined && isInsideReferrer(referrer);
  if (!named && (inside || !pageLoad)) return undefined;
  const source = inside ? undefined : toVisitUrl(referrer);
  if (source) fields.referrer = source;
  const landingUrl = toVisitUrl(window.location.href);
  if (landingUrl) fields.landing_url = landingUrl;
  return fields;
}

function recordArrival(fields: VisitFields, now: number): void {
  const visit = { fields, landedAt: now };
  const first = readStoredVisit(FIRST_VISIT_KEY);
  const last = readStoredVisit(LAST_VISIT_KEY);
  if (isDirect(fields)) {
    if (!first) writeVisit(FIRST_VISIT_KEY, visit);
    if (!last) writeVisit(LAST_VISIT_KEY, visit);
    return;
  }
  if (!first || isDirect(first.fields)) writeVisit(FIRST_VISIT_KEY, visit);
  // The same arrival again (a reload) keeps the time it was first seen.
  if (!last || !sameFields(last.fields, fields)) writeVisit(LAST_VISIT_KEY, visit);
  for (const [platform, param] of Object.entries(CLICK_PLATFORMS) as [ClickPlatform, VisitField][]) {
    const id = fields[param];
    if (id) keepClick(platform, { id, clickedAt: now });
  }
}

/** The addresses this page load has already captured. A module lives as long as its page load. */
let capturedUrls = new Set<string>();

/**
 * Record what the current address stands for: a handoff, an arrival or a direct visit. Safe to
 * call any number of times: each address of the page load counts once, and only the first one
 * has the document's referrer. `visitUrls: false` records no referrer or landing page and no
 * direct visit, for a page that is not on the web (the app shells' bundle URLs).
 */
export function captureVisit({ visitUrls }: { visitUrls: boolean }): void {
  if (!isBrowser()) return;
  migrateLegacyEntries();
  let href: string;
  let params: URLSearchParams;
  try {
    href = window.location.href;
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  if (capturedUrls.has(href)) return;
  const pageLoad = capturedUrls.size === 0;
  capturedUrls.add(href);

  const handoff = readHandoffQuery(params);
  if (handoff) {
    mergeHandoff(handoff);
    return;
  }
  const arrival = readArrival(params, pageLoad, visitUrls);
  if (arrival) recordArrival(arrival, Date.now());
}

/** Start a new page load. For tests: in the browser a page load ends when the document does. */
export function startPageLoad(): void {
  capturedUrls = new Set();
}
