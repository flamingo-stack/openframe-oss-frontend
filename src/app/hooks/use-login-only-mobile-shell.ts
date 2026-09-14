'use client';

import { useSyncExternalStore } from 'react';
import { isLoginOnlyMobileShell } from '@/lib/app-mode';

const noSubscription = () => () => {};

/**
 * {@link isLoginOnlyMobileShell} for render. The auth layouts are prerendered by the static export,
 * where no shell exists, so a plain call would render the compact login screen over prerendered
 * tabbed markup and fail hydration. The server snapshot keeps the hydration pass on the prerendered
 * answer and React re-renders with the real one; a document never changes shell, so nothing is
 * subscribed.
 */
export function useLoginOnlyMobileShell(): boolean {
  return useSyncExternalStore(noSubscription, isLoginOnlyMobileShell, () => false);
}
