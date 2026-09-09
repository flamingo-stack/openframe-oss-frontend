/**
 * Tell React this is an `act()` environment.
 *
 * Without it React both warns on every `act()` call and, more importantly,
 * keeps its counterpart check switched off — so a component test that updates
 * state OUTSIDE an `act()` wrap fails silently instead of being reported. Set
 * here rather than per-file so component tests added later inherit it.
 *
 * Cast rather than `declare global`: tsconfig pulls this root file into the app
 * program, so augmenting `globalThis` would make a test-only flag look like an
 * always-present global to shipping code.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * jsdom ships no `ResizeObserver`, and the core library's `TruncateText` — the
 * text primitive most detail views are built from — subscribes to one on mount
 * (`use-is-truncated`) to decide whether to attach its tooltip. Without a stub
 * every component test that renders core UI dies in an effect rather than in an
 * assertion. Observing nothing is the honest behaviour here: jsdom has no layout
 * engine, so nothing would ever be reported as resized anyway.
 */
if (typeof globalThis.ResizeObserver !== 'function') {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/**
 * jsdom has no `matchMedia` either, and the same import graph reaches it: the
 * core barrel pulls in `media-chrome`, whose module scope feature-detects
 * picture-in-picture through a media query. Reporting "no match" is what a
 * headless DOM with no viewport can truthfully say.
 */
if (typeof globalThis.matchMedia !== 'function') {
  (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
}
