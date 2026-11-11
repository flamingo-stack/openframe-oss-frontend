'use client';

import { createContext, useContext } from 'react';

/**
 * Whether the session's composer dock serves the Manhattan v2 centre:
 * the open chat in the chat column beside the page instead of the sheet over it. `false`
 * (the default, and the Mingo-first shell) leaves the dock exactly as it is.
 */
export const ManhattanDockContext = createContext(false);

export function useManhattanDock(): boolean {
  return useContext(ManhattanDockContext);
}
