'use client';

import { useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => undefined;
const onClient = () => true;
const onServer = () => false;

/**
 * `false` in the server's markup and while the browser hydrates it, `true` from the next render.
 *
 * For what only the browser knows (the viewer's clock, `sessionStorage`): drawn before then,
 * the first client render differs from the server's HTML and React throws the tree away.
 * A component mounted after hydration (a client navigation) is `true` at once, so it never
 * draws the server's form for a frame.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, onClient, onServer);
}
