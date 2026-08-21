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
export const sidebarWidthFoucScript = runtimeJoin`(function(){try{var m=localStorage.getItem('${SIDEBAR_MINIMIZED_STORAGE_KEY}')==='true';document.documentElement.style.setProperty('${SIDEBAR_WIDTH_CSS_VAR}',m?'${SIDEBAR_MINIMIZED_WIDTH}px':'${SIDEBAR_EXPANDED_WIDTH}px');}catch(e){}})();`;
