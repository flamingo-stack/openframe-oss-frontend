'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** The right navigation's expanded width (Figma 200). */
export const MANHATTAN_NAVIGATION_EXPANDED_WIDTH = 200;
/** Where the right navigation keeps the sections the user folded. */
export const MANHATTAN_NAVIGATION_FOLDS_KEY = 'of.manhattan.navigation.folded';

/**
 * The right navigation's collapse. Not persisted: every load starts collapsed (expanded it
 * crowds the centre), and the user's toggle lasts until the next load. One value per page on
 * purpose: a page has one shell, and its navigation and phone menu read the same collapse.
 */
let navCollapsed = true;
const navCollapsedListeners = new Set<() => void>();

function subscribeNavCollapsed(listener: () => void): () => void {
  navCollapsedListeners.add(listener);
  return () => {
    navCollapsedListeners.delete(listener);
  };
}

const readNavCollapsed = () => navCollapsed;

/** `[collapsed, setCollapsed]` for the right navigation (`NavigationSidebarConfig.collapsed` / `onCollapsedChange`). */
export function useManhattanNavCollapsed(): readonly [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribeNavCollapsed, readNavCollapsed, readNavCollapsed);
  const setCollapsed = useCallback((next: boolean) => {
    navCollapsed = next;
    for (const listener of navCollapsedListeners) listener();
  }, []);
  return [collapsed, setCollapsed] as const;
}
