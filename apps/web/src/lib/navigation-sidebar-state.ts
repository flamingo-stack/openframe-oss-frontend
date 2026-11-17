/**
 * Shared constants for the navigation sidebar's persisted collapse state.
 *
 * These mirror the core `NavigationSidebar` (whose width/storage constants are
 * module-local and not exported). This module is intentionally framework
 * -neutral (no `'use client'`) so the server root layout can import it — that is
 * where the pre-paint seed script below is emitted.
 */

const SIDEBAR_MINIMIZED_WIDTH = 56;
export const SIDEBAR_EXPANDED_WIDTH = 224;
/** The Mingo-first sidebar's expanded width — a SaaS tenant's (see `AppShell`). */
export const GROUPED_SIDEBAR_EXPANDED_WIDTH = 264;
/** The Manhattan v2 chats sidebar's expanded width (Figma 280), what a SaaS tenant gets; the user's dragged width wins (`SIDEBAR_RESIZE`). */
export const MANHATTAN_CHATS_EXPANDED_WIDTH = 280;
/** The Manhattan v2 chats sidebar's width as a drawer (800-911px, the compact top bar opens it over the page). */
export const MANHATTAN_CHATS_DRAWER_WIDTH = 300;
const SIDEBAR_MINIMIZED_STORAGE_KEY = 'of.navigationSidebar.minimized';
/** The Manhattan v2 right navigation's expanded width (Figma 200). */
export const MANHATTAN_NAVIGATION_EXPANDED_WIDTH = 200;
/**
 * Where the Manhattan v2 right navigation keeps the collapse the user chose (JSON `true` / `false`).
 * Nothing stored: the default by window width ({@link MANHATTAN_NAV_OPEN_FROM_WIDTH}). A key of its
 * own, not the left sidebar's, and not the `of.manhattan.navigation.minimized` an earlier build
 * wrote (a value left there from when the navigation always started collapsed must not decide now).
 */
const MANHATTAN_NAV_COLLAPSED_STORAGE_KEY = 'of.manhattan.navigation.collapsed';
/**
 * From this window width (the `lg` step) the right navigation is open by default, beside the open
 * chats sidebar; narrower it starts as the rail, so the centre keeps its room. The user's own
 * choice, once made, wins at every width.
 */
export const MANHATTAN_NAV_OPEN_FROM_WIDTH = 1280;
const MANHATTAN_NAV_OPEN_QUERY = `(min-width: ${MANHATTAN_NAV_OPEN_FROM_WIDTH}px)`;

/**
 * The expanded width's bounds when the user drags it (`NavigationSidebarConfig.resizable`,
 * both shells). 200px keeps an icon and a dozen characters of label (the rows truncate
 * below their full width anyway); 480px leaves the content 800px of a 1280px window,
 * clear of the `content-md` breakpoint (720px) its layouts switch at.
 */
export const SIDEBAR_MIN_EXPANDED_WIDTH = 200;
export const SIDEBAR_MAX_EXPANDED_WIDTH = 480;
/**
 * Where the core sidebar keeps the width the user chose: `{ size }` under this key
 * plus `:chosen` (its `useResizablePanelSize`). Passed as `resizable.storageKey`, and
 * read back by the seed below so the first frame is already that wide.
 */
export const SIDEBAR_WIDTH_STORAGE_KEY = 'of.navigationSidebar.width';
const SIDEBAR_CHOSEN_WIDTH_STORAGE_KEY = `${SIDEBAR_WIDTH_STORAGE_KEY}:chosen`;

/**
 * The expanded width the user chose for the sidebar (dragged or stepped), clamped to the
 * bounds; `fallback` when none was chosen or storage refuses. Client only.
 */
export function readChosenSidebarWidth(fallback: number): number {
  try {
    const chosen: unknown = JSON.parse(window.localStorage.getItem(SIDEBAR_CHOSEN_WIDTH_STORAGE_KEY) ?? 'null');
    const size = (chosen as { size?: unknown } | null)?.size;
    if (typeof size !== 'number' || !Number.isFinite(size)) return fallback;
    return Math.min(SIDEBAR_MAX_EXPANDED_WIDTH, Math.max(SIDEBAR_MIN_EXPANDED_WIDTH, Math.round(size)));
  } catch {
    return fallback;
  }
}

/**
 * `NavigationSidebarConfig.resizable` for both shells: the bounds above and the key
 * the seed reads. One object, so the two shells and the seed cannot disagree.
 */
export const SIDEBAR_RESIZE = {
  minWidth: SIDEBAR_MIN_EXPANDED_WIDTH,
  maxWidth: SIDEBAR_MAX_EXPANDED_WIDTH,
  storageKey: SIDEBAR_WIDTH_STORAGE_KEY,
};

/**
 * CSS variable seeded before first paint (by {@link sidebarWidthFoucScript}) so
 * the sidebar renders at the persisted width from the very first frame.
 * `localStorage` is unreadable on the server, so without this the sidebar
 * flashes expanded → minimized on every refresh — and, worse, any markup derived
 * from the preference disagrees with the server's HTML and React regenerates the
 * whole tree.
 *
 * The string is the core lib's `NAVIGATION_SIDEBAR_WIDTH_VAR`, which its sidebar
 * reads through an arbitrary-value width utility scoped to `lg` and rewrites on
 * toggle. Duplicated as a literal rather than imported because this module is
 * deliberately framework-neutral (the SERVER root layout imports it) and the
 * lib's constant ships from a `'use client'` barrel — so if that name ever
 * changes in the lib, nothing here fails to compile. It has to be checked by hand.
 *
 * Do NOT write an abbreviated utility class in prose anywhere under `src/`:
 * Tailwind scans these files as raw text and cannot tell code from comment, so a
 * placeholder inside square brackets becomes a real candidate and emits CSS with
 * an ellipsis where a custom property belongs — which fails the build.
 */
const SIDEBAR_WIDTH_CSS_VAR = '--of-navigation-sidebar-width';
/**
 * The right navigation's width var (the lib's `NAVIGATION_SIDEBAR_END_WIDTH_VAR`, spelled out
 * for the same reason). The grouped shell's right navigation follows the user's stored choice,
 * else the window (open from {@link MANHATTAN_NAV_OPEN_FROM_WIDTH}, the rail below), as
 * `useManhattanNavCollapsed` reads it, so the seed is its expanded width or the rail.
 */
const SIDEBAR_END_WIDTH_CSS_VAR = '--of-navigation-sidebar-end-width';

/**
 * The sidebar's root element. Used by viewport-`fixed` overlays that have to
 * clear the sidebar but can't read its width any other way — the core `NavigationSidebar` keeps
 * its collapse state module-internal, and the `useLocalStorage` it persists
 * through emits no in-tab event, so a second reader of that key never learns
 * about a toggle.
 */
export const SIDEBAR_ELEMENT_SELECTOR = 'aside[aria-label="Main navigation sidebar"]';

/**
 * LIVE sidebar width, mirrored from the element above into a CSS variable by
 * whoever needs it (see `useSidebarWidthVar` in `walkthrough-video.tsx`).
 * Distinct from the seed var: that one is a pre-paint SEED and goes stale the
 * moment the user toggles the sidebar, because the toggle writes the new width
 * straight onto the element.
 */
export const SIDEBAR_LIVE_WIDTH_CSS_VAR = '--of-sidebar-live-width';

/**
 * Assembled through a tagged template so the value is built at runtime. A plain
 * concatenation or constant template literal gets constant-folded by Turbopack's
 * SWC minifier, which mis-folds this particular string and silently drops the
 * `getItem` comparison and the `matchMedia` line — corrupting the emitted
 * inline script. The tag call blocks that fold.
 */
const runtimeJoin = (parts: TemplateStringsArray, ...values: Array<string | number>): string =>
  parts.reduce<string>((acc, part, i) => acc + part + (i < values.length ? values[i] : ''), '');

/**
 * Inline FOUC-prevention script. Runs synchronously in `<head>` before first
 * paint: reads the persisted collapse state and seeds the sidebar width var.
 * `grouped`: the Mingo-first sidebar (a SaaS tenant), which is wider. The root
 * layout answers it from the app mode on the SERVER: in the browser the runtime env
 * (`window.__ENV`) lands after this script — `PublicEnvScript` goes through Next's
 * `beforeInteractive` queue — so the script cannot ask it.
 *
 * This is the whole mechanism by which a preference that only `localStorage`
 * knows reaches the first frame. It cannot travel through React: the server
 * cannot read it, so any markup derived from it would differ between the SSR'd
 * HTML and the hydration render, and React would throw the tree away.
 *
 * The WIDTH is all it seeds. It briefly also published the preference as a
 * number for the collapse chevron; core `0.0.500` derives that from the rail's
 * rendered width with a container query instead, so the property has no reader
 * left and seeding it is dead weight in a script that blocks first paint.
 *
 * The expanded width is the one the user dragged the sidebar to, when there is
 * one (`SIDEBAR_CHOSEN_WIDTH_STORAGE_KEY`), within the bounds the config gives the
 * sidebar, else the shell's default. A malformed entry is ignored, not fatal: its
 * parse has a try of its own, so the collapse still seeds.
 *
 * Viewport-free on purpose. It used to force the minimized width between 800px
 * and 1280px, back when a placeholder applied this var at every breakpoint. The
 * sidebar now pins the tablet rail in CSS (`md:w-14`) and reads the var only from
 * `lg`, so a viewport check here would poison the DESKTOP value for anyone who
 * loaded at tablet width and then widened the window.
 */
/**
 * `localStorage` key of the Manhattan v2 chat / page divider (`AppLayoutWorkArea` `storageKey`):
 * here, beside the other seeds, so the server root layout can seed the divider's place before
 * paint (`workAreaShareSeedScript` from the core lib's server-safe `utils`).
 */
export const MANHATTAN_WORK_AREA_STORAGE_KEY = 'of.manhattan.workArea';

export function sidebarWidthFoucScript(grouped: boolean): string {
  const expanded = grouped ? MANHATTAN_CHATS_EXPANDED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const endSeed = grouped
    ? runtimeJoin`var ew='${MANHATTAN_NAVIGATION_EXPANDED_WIDTH}px';try{var es=localStorage.getItem('${MANHATTAN_NAV_COLLAPSED_STORAGE_KEY}');var ec=es==='true'||(es!=='false'&&window.innerWidth<${MANHATTAN_NAV_OPEN_FROM_WIDTH});ew=ec?'${SIDEBAR_MINIMIZED_WIDTH}px':ew;}catch(x){ew=window.innerWidth<${MANHATTAN_NAV_OPEN_FROM_WIDTH}?'${SIDEBAR_MINIMIZED_WIDTH}px':ew;}document.documentElement.style.setProperty('${SIDEBAR_END_WIDTH_CSS_VAR}',ew);`
    : '';
  return runtimeJoin`(function(){${endSeed}try{var m=localStorage.getItem('${SIDEBAR_MINIMIZED_STORAGE_KEY}')==='true';var w=${expanded};try{var c=JSON.parse(localStorage.getItem('${SIDEBAR_CHOSEN_WIDTH_STORAGE_KEY}'));if(c&&typeof c.size==='number'&&isFinite(c.size)){w=Math.min(${SIDEBAR_MAX_EXPANDED_WIDTH},Math.max(${SIDEBAR_MIN_EXPANDED_WIDTH},Math.round(c.size)));}}catch(e){}document.documentElement.style.setProperty('${SIDEBAR_WIDTH_CSS_VAR}',m?'${SIDEBAR_MINIMIZED_WIDTH}px':w+'px');}catch(e){}})();`;
}

// --------------------------------------------------------------------------
// The persisted preference as a store — for a host that CONTROLS the collapse
// --------------------------------------------------------------------------

/**
 * The core sidebar's in-page change event (`useLocalStorage` listens for it), so the
 * sidebar's own copy of the preference follows a write made here.
 */
const LOCAL_STORAGE_UPDATE_EVENT = 'localStorageUpdate';

/**
 * The desktop collapse preference, for the Mingo-first shell: it controls the sidebar
 * (`NavigationSidebarConfig.collapsed`) so ⌘K can reveal it, and a controlled sidebar
 * persists nothing itself. Same key and encoding (JSON `true` / `false`) as the core
 * sidebar's own persisted preference, so the seed script above stays right in both shells
 * and the preference carries over when the user switches between them.
 */
export function readSidebarMinimized(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_MINIMIZED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Stores a flag under `key` (JSON `true` / `false`) and tells every reader on the page: the subscribers below and the
 * core sidebar's copy (`LOCAL_STORAGE_UPDATE_EVENT`). Storage refused (Safari private mode, blocked site data): nothing
 * is stored, the event still moves every reader.
 */
function writeStoredFlag(key: string, value: boolean): void {
  const newValue = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, newValue);
  } catch {
    // Refused: the caller decides what lasts for this page.
  }
  window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_UPDATE_EVENT, { detail: { key, newValue } }));
}

/** Persist the preference and tell every reader on the page. Refused storage: it lasts for this page only. */
export function writeSidebarMinimized(minimized: boolean): void {
  writeStoredFlag(SIDEBAR_MINIMIZED_STORAGE_KEY, minimized);
}

/** `useSyncExternalStore` subscription to one stored key: writes on this page and in other tabs. */
function subscribeStorageKey(key: string, listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) listener();
  };
  const onUpdate = (event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (typeof detail === 'object' && detail !== null && 'key' in detail && detail.key === key) {
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(LOCAL_STORAGE_UPDATE_EVENT, onUpdate);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(LOCAL_STORAGE_UPDATE_EVENT, onUpdate);
  };
}

/** `useSyncExternalStore` subscription: writes on this page (either sidebar's) and other tabs. */
export function subscribeSidebarMinimized(listener: () => void): () => void {
  return subscribeStorageKey(SIDEBAR_MINIMIZED_STORAGE_KEY, listener);
}

// --------------------------------------------------------------------------
// The Manhattan v2 right navigation's collapse
// --------------------------------------------------------------------------

/** The user's choice on this page, for when storage refuses it (a private window, blocked site data). */
let manhattanNavCollapsedChoice: boolean | null = null;

/** The right navigation's default when the user has chosen nothing: the rail below {@link MANHATTAN_NAV_OPEN_FROM_WIDTH}. */
function manhattanNavCollapsedByWidth(): boolean {
  return typeof window.matchMedia === 'function'
    ? !window.matchMedia(MANHATTAN_NAV_OPEN_QUERY).matches
    : window.innerWidth < MANHATTAN_NAV_OPEN_FROM_WIDTH;
}

/**
 * Whether the right navigation is collapsed: the user's stored choice, else the default by window width (open from
 * {@link MANHATTAN_NAV_OPEN_FROM_WIDTH}, the rail below). Client only; open on the server.
 */
export function readManhattanNavCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(MANHATTAN_NAV_COLLAPSED_STORAGE_KEY);
  } catch {
    // Storage refused: the default by width.
  }
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return manhattanNavCollapsedChoice ?? manhattanNavCollapsedByWidth();
}

/** Stores the right navigation's collapse and moves every reader on this page. */
export function writeManhattanNavCollapsed(collapsed: boolean): void {
  // Kept for the page too, for when storage refuses it (`readManhattanNavCollapsed` falls back on it).
  manhattanNavCollapsedChoice = collapsed;
  writeStoredFlag(MANHATTAN_NAV_COLLAPSED_STORAGE_KEY, collapsed);
}

/**
 * `useSyncExternalStore` subscription for {@link readManhattanNavCollapsed}: the stored choice, and the window crossing
 * {@link MANHATTAN_NAV_OPEN_FROM_WIDTH} (which moves the default while the user has chosen nothing).
 */
export function subscribeManhattanNavCollapsed(listener: () => void): () => void {
  const unsubscribeStorage = subscribeStorageKey(MANHATTAN_NAV_COLLAPSED_STORAGE_KEY, listener);
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(MANHATTAN_NAV_OPEN_QUERY) : null;
  query?.addEventListener('change', listener);
  return () => {
    unsubscribeStorage();
    query?.removeEventListener('change', listener);
  };
}
