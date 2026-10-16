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
const SIDEBAR_MINIMIZED_STORAGE_KEY = 'of.navigationSidebar.minimized';

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
 * Viewport-free on purpose. It used to force the minimized width between 800px
 * and 1280px, back when a placeholder applied this var at every breakpoint. The
 * sidebar now pins the tablet rail in CSS (`md:w-14`) and reads the var only from
 * `lg`, so a viewport check here would poison the DESKTOP value for anyone who
 * loaded at tablet width and then widened the window.
 */
export function sidebarWidthFoucScript(grouped: boolean): string {
  const expanded = grouped ? GROUPED_SIDEBAR_EXPANDED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  return runtimeJoin`(function(){try{var m=localStorage.getItem('${SIDEBAR_MINIMIZED_STORAGE_KEY}')==='true';document.documentElement.style.setProperty('${SIDEBAR_WIDTH_CSS_VAR}',m?'${SIDEBAR_MINIMIZED_WIDTH}px':'${expanded}px');}catch(e){}})();`;
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

/** Persist the preference and tell every reader on the page — the subscribers below and the core sidebar's copy. */
export function writeSidebarMinimized(minimized: boolean): void {
  const newValue = JSON.stringify(minimized);
  try {
    window.localStorage.setItem(SIDEBAR_MINIMIZED_STORAGE_KEY, newValue);
  } catch {
    // Storage refused (Safari private mode, blocked site data): the preference lasts
    // for this page only. The event below still moves every reader.
  }
  window.dispatchEvent(
    new CustomEvent(LOCAL_STORAGE_UPDATE_EVENT, { detail: { key: SIDEBAR_MINIMIZED_STORAGE_KEY, newValue } }),
  );
}

/** `useSyncExternalStore` subscription: writes on this page (either sidebar's) and other tabs. */
export function subscribeSidebarMinimized(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SIDEBAR_MINIMIZED_STORAGE_KEY) listener();
  };
  const onUpdate = (event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (
      typeof detail === 'object' &&
      detail !== null &&
      'key' in detail &&
      detail.key === SIDEBAR_MINIMIZED_STORAGE_KEY
    ) {
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
