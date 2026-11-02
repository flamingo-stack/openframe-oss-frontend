'use client';

import { useSyncExternalStore } from 'react';
import { type DesktopSignInWait, getDesktopSignInWait, subscribeDesktopSignInWait } from '@/lib/desktop-sign-in-wait';

/** Prerendered HTML is never mid-sign-in. */
function getServerSnapshot(): null {
  return null;
}

/** The desktop sign-in waiting on the browser, or null when none is. */
export function useDesktopSignInWait(): DesktopSignInWait | null {
  return useSyncExternalStore(subscribeDesktopSignInWait, getDesktopSignInWait, getServerSnapshot);
}
