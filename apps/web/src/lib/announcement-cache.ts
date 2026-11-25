/**
 * The hub announcement's last answer on this device, so the top bar is in place from the first paint
 * (CU-17tkuw69v1p).
 *
 * The bar's slot opens once `/me` has answered, and its content is fetched after that, so on its own the bar
 * arrived about half a second after the page and pushed it down by its height. The app keeps the last answer
 * here (`useActiveAnnouncement` writes every one it gets); the root layout's `<head>` reads it before paint
 * (`announcementSeedScript`) and marks `<html>` when that answer would draw a bar, so the shell holds the bar's
 * room (`AnnouncementBarSeed`) until the bar itself mounts with the stored answer.
 *
 * An answer older than {@link ANNOUNCEMENT_STORE_TTL_MS} counts as none: a campaign the admin has since turned
 * off must not come back at first paint on every device that saw it. A first load (nothing stored) draws the
 * bar once its answer arrives, as before. Server-safe: the root layout (a server component) emits the script.
 *
 * Persisted shape (`v: 1`). A new key, so a rollback to the bundle before it simply ignores it; add fields only.
 */

import type { Announcement, AnnouncementSurface } from '@flamingo-stack/openframe-frontend-core/types';

export const ANNOUNCEMENT_STORAGE_KEY = 'of.announcement.last';

/** Set on `<html>` before paint when the stored answer would draw a bar on this page. */
export const ANNOUNCEMENT_SEED_ATTRIBUTE = 'data-announcement';

/** The stored announcement's background, for the room the shell holds (`AnnouncementBarSeed`). */
export const ANNOUNCEMENT_SEED_BACKGROUND_VAR = '--announcement-seed-bg';

/** How long a stored answer may seed the bar. */
export const ANNOUNCEMENT_STORE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredAnnouncement {
  v: 1;
  /** `null`: the hub had no active announcement. */
  announcement: Announcement | null;
  /** The surface this bundle runs in when it stored the answer: the script cannot ask the shell before paint. */
  surface: AnnouncementSurface;
  /** When the answer was fetched (ms). */
  storedAt: number;
}

function isStoredAnnouncement(value: unknown): value is StoredAnnouncement {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<StoredAnnouncement>;
  return (
    entry.v === 1 &&
    typeof entry.storedAt === 'number' &&
    typeof entry.surface === 'string' &&
    (entry.announcement === null || (typeof entry.announcement === 'object' && entry.announcement !== undefined))
  );
}

/**
 * The stored answer while it is fresh: the announcement, `null` when the hub had none, `undefined` when nothing
 * usable is stored (never stored, older than the TTL, unreadable, or storage blocked).
 */
export function readStoredAnnouncement(now: number = Date.now()): StoredAnnouncement | undefined {
  try {
    const raw = window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredAnnouncement(parsed)) return undefined;
    const age = now - parsed.storedAt;
    return age >= 0 && age < ANNOUNCEMENT_STORE_TTL_MS ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function storeAnnouncement(
  announcement: Announcement | null,
  surface: AnnouncementSurface,
  storedAt: number,
): void {
  try {
    const entry: StoredAnnouncement = { v: 1, announcement, surface, storedAt };
    window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Private mode or blocked storage: the next load draws the bar once its answer arrives.
  }
}

/** The lib bar's dismissal entry: `<platform>-announcement-dismissed` (`announcementDismissCookieName`). */
const DISMISSAL_SUFFIX = '-announcement-dismissed';

/**
 * Runs in `<head>` before paint. Marks `<html>` when the stored answer is fresh and would draw a bar here, by the
 * lib bar's own rules: for this surface, not under one of its `excluded_paths` (whole-path patterns, matched with
 * and without the trailing slash `trailingSlash` adds), and not dismissed. The dismissal is found by its name's
 * suffix (the prefix is the lib's platform, and a host serves one platform's cookie): the cookie where cookies
 * work, else the lib's localStorage fallback under the same name, else the legacy per-id key.
 */
export function announcementSeedScript(): string {
  const key = JSON.stringify(ANNOUNCEMENT_STORAGE_KEY);
  const suffix = JSON.stringify(DISMISSAL_SUFFIX);
  return (
    `(function(){try{` +
    `var s=JSON.parse(localStorage.getItem(${key}));` +
    `if(!s||s.v!==1||typeof s.storedAt!=='number')return;` +
    `var age=Date.now()-s.storedAt;if(!(age>=0&&age<${ANNOUNCEMENT_STORE_TTL_MS}))return;` +
    `var a=s.announcement;if(!a||typeof a.id!=='string')return;` +
    `if(a.surfaces&&a.surfaces.length&&a.surfaces.indexOf(s.surface)<0)return;` +
    `var p=location.pathname,q=p.length>1&&p.charAt(p.length-1)==='/'?p.slice(0,-1):p,x=a.excluded_paths||[];` +
    `for(var i=0;i<x.length;i++){try{var r=new RegExp('^(?:'+String(x[i]).trim()+')$');if(r.test(p)||r.test(q))return}catch(e){}}` +
    `var u=${suffix},d,k,j;` +
    `if(/^https?:/.test(document.URL)){var c=document.cookie?document.cookie.split('; '):[];for(j=0;j<c.length;j++){k=c[j].indexOf('=');if(k>0&&c[j].slice(0,k).slice(-u.length)===u){d=decodeURIComponent(c[j].slice(k+1));break}}}` +
    `else{for(j=0;j<localStorage.length;j++){k=localStorage.key(j);if(k&&k.slice(-u.length)===u){d=JSON.parse(localStorage.getItem(k));break}}}` +
    `if(d!==undefined){if(d===a.id)return}` +
    `else{var l='-announcement-'+a.id+'-dismissed';for(j=0;j<localStorage.length;j++){k=localStorage.key(j);if(k&&k.slice(-l.length)===l)return}}` +
    `var e=document.documentElement;e.setAttribute('${ANNOUNCEMENT_SEED_ATTRIBUTE}','');` +
    `if(typeof a.background_color==='string')e.style.setProperty('${ANNOUNCEMENT_SEED_BACKGROUND_VAR}',a.background_color)` +
    `}catch(e){}})();`
  );
}
