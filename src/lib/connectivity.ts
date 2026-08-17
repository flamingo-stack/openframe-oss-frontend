'use client';

import { networkPlugin } from './native-shell';

/**
 * The app's connectivity signal for react-query and the offline banner.
 *
 * Deliberately NOT a recovery mechanism. A link reporting "up" is not a server
 * answering — measured 1.2s and 6.7s gaps between the two on device — so
 * recovery from a failed request belongs to the retry policy in
 * `lib/relay/environment.ts` and react-query's own, both of which key off
 * request outcomes. This only answers "is there a link".
 *
 * NOT wired here: `lib/meshcentral/websocket-manager.ts` still drives its own
 * reconnect off the raw window events, so it keeps the lag described below.
 *
 * ## Why this is not just `navigator.onLine`
 *
 * In WKWebView `navigator.onLine` is accurate but LATE. Measured on an iPhone 15
 * Pro Max (iOS 26.6) across airplane-mode cycles, comparing the OS signal against
 * the window events:
 *
 *   - drop:    `@capacitor/network` reported `connected=false` 2.0s BEFORE the
 *              `offline` event fired
 *   - restore: it reported `connected=true` while `navigator.onLine` still read
 *              `false`. The lag varies: in one run the window `online` event
 *              trailed the OS signal by ~60s, in another by ~2.5s
 *
 * That lag is not cosmetic, because react-query's `onlineManager` is driven by
 * exactly those two window events, and it is what decides when a paused query may
 * resume. Once the event finally landed, every paused query completed within
 * ~500ms — the resume path was never broken, it was starved. `@capacitor/network`
 * reads `SCNetworkReachability`, a different layer, and leads WebKit at both
 * edges. The browser keeps the standard events, where they are accurate.
 *
 * Note this is reachability, NOT reachability of our gateway: a captive portal
 * reports connected. Request outcomes remain the source of truth for whether the
 * API works; this only answers "is there a link, and did it just come back".
 *
 * ## Shape
 *
 * A plain subscribable store, deliberately not a hook or a context: the offline
 * banner mounts in the root layout OUTSIDE every provider (`app/layout.tsx`), and
 * `onlineManager` is wired from module scope in `query-client.ts`. Neither can
 * reach React context.
 */

type Listener = (online: boolean) => void;

/**
 * Optimistic default, matching `onlineManager`'s own. A false start would pause
 * every query before the first status read resolves; a false-positive "online"
 * only costs one request that fails the way any request can.
 */
let online = true;
const listeners = new Set<Listener>();
let sourceStarted = false;
/**
 * Set once a live `networkStatusChange` has been seen, so the initial
 * `getStatus()` read cannot land afterwards and overwrite it with a staler value
 * — the two are issued together and their resolution order is not guaranteed.
 */
let sawNativeEvent = false;
/**
 * Set once the platform source has published ANYTHING, event or `getStatus`.
 * Distinct from `sawNativeEvent` because the two guard different things: that one
 * orders the two native reads against each other, this one keeps the web fallback
 * from reseeding over a native answer. Without the split, an `addListener`
 * rejection arriving after `getStatus()` had already published `connected:false`
 * would start the web source and seed a stale `navigator.onLine === true` over
 * it — the exact overwrite the guard exists to prevent.
 */
let nativePublished = false;
let webSourceStarted = false;

function publish(next: boolean): void {
  if (online === next) return;
  online = next;
  // Snapshot: listeners unsubscribe from inside this loop (`waitForOnline` in
  // `lib/relay/environment.ts` does exactly that), and one that subscribes here
  // would otherwise be delivered the value twice — `subscribeConnectivity` calls
  // it immediately AND the live iteration would reach it.
  for (const listener of [...listeners]) listener(next);
}

function startWebSource(): void {
  if (webSourceStarted) return;
  webSourceStarted = true;
  window.addEventListener('online', () => publish(true));
  window.addEventListener('offline', () => publish(false));
  // Only seed from `navigator.onLine` if nothing better has been heard. After a
  // native `connected:false` this would otherwise flip the store back to `true`
  // — WKWebView's value is the stale one this module exists to bypass — and the
  // real reconnect edge would then be swallowed by `publish`'s equality guard,
  // so subscribers would never be told the link came back.
  if (nativePublished) return;
  publish(navigator.onLine);
}

/**
 * Attach to the platform source, once.
 *
 * Resolved synchronously with no retry, like the seven sibling accessors in
 * `native-shell.ts`: both shells install their globals before any page script
 * runs (see `platform.ts`), so a null plugin here means the shell binary predates
 * it — a permanent condition that retrying cannot fix, and one the web listeners
 * serve correctly.
 *
 * Every bridge call is wrapped: the injected proxy is SYNCHRONOUS (see
 * `NetworkPlugin` in `native-shell.ts`), so a throw here would escape through
 * `query-client.ts`'s module-scope wiring and take down bundle evaluation rather
 * than merely degrading connectivity.
 */
function startSource(): void {
  const net = networkPlugin();
  if (!net) {
    startWebSource();
    return;
  }

  try {
    void Promise.resolve(
      net.addListener('networkStatusChange', status => {
        sawNativeEvent = true;
        nativePublished = true;
        publish(!!status?.connected);
      }),
    ).catch((error: unknown) => {
      // No listener means the store would be frozen at the one `getStatus` read
      // for the life of the process, so fall back rather than limp on.
      console.error('[Connectivity] networkStatusChange registration failed:', error);
      startWebSource();
    });

    void net
      .getStatus()
      .then(status => {
        if (sawNativeEvent) return;
        nativePublished = true;
        publish(!!status?.connected);
      })
      .catch((error: unknown) => {
        // `networkStatusChange` only fires on CHANGE, so without this an app
        // launched already-offline would report online until the link moved.
        // Skipped once a real event has landed — see `startWebSource`.
        console.error('[Connectivity] getStatus failed:', error);
        if (sawNativeEvent) return;
        publish(navigator.onLine);
      });
  } catch (error) {
    console.error('[Connectivity] Network plugin attach threw:', error);
    startWebSource();
  }
}

function ensureSource(): void {
  if (sourceStarted) return;
  sourceStarted = true;
  startSource();
}

/**
 * Current link state, for callers outside React that must decide something NOW.
 * `lib/relay/environment.ts` uses it to avoid spending a retry attempt on a link
 * it already knows is down. Optimistic (`true`) until the platform source
 * answers — see the note on `online` above.
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  ensureSource();
  return online;
}

/**
 * Subscribe to connectivity changes. The callback fires immediately with the
 * current value, then on every change.
 *
 * Returns synchronously, which `onlineManager` requires: it keeps the returned
 * value as its cleanup, and a non-function there breaks its next teardown.
 * The platform listener is process-wide and is never removed — there is exactly
 * one, and it costs nothing idle.
 */
export function subscribeConnectivity(listener: Listener): () => void {
  if (typeof window === 'undefined') return () => undefined;

  // Before adding the listener: the web path publishes synchronously inside
  // `startSource`, which would otherwise deliver this listener the same value
  // twice.
  ensureSource();
  listeners.add(listener);
  listener(online);

  return () => {
    listeners.delete(listener);
  };
}
