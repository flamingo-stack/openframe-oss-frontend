'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * What the page slot draws while the page itself cannot: the landing page's skeleton on a landing route (Start Work,
 * Mingo's home, the dashboard), nothing elsewhere. The shell's page slot (`PageSlot`) sets it once, for its boundary's
 * fallback and for whatever stands between the boundary and the page and waits before rendering it
 * (`DeviceStatusSupportGate`). Without it the centre of a landing page went empty for as long as the page's chunk
 * loaded or the gate waited, between the shell's skeleton and the page's own (CU-17tkuw69uzq).
 */
const PageFallbackContext = createContext<ReactNode>(null);

export const PageFallbackProvider = PageFallbackContext.Provider;

/** The page slot's stand-in while the page cannot render; `null` outside a landing route or a shell. */
export function usePageFallback(): ReactNode {
  return useContext(PageFallbackContext);
}
