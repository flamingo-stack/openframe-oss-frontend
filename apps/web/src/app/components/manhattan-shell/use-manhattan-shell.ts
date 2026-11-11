'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** The chats sidebar's expanded width (Figma 280); the user's dragged width wins (`SIDEBAR_RESIZE`). */
export const MANHATTAN_CHATS_EXPANDED_WIDTH = 280;
/** The right navigation's expanded width (Figma 200). */
export const MANHATTAN_NAVIGATION_EXPANDED_WIDTH = 200;
/** Where the right navigation keeps the sections the user folded. */
export const MANHATTAN_NAVIGATION_FOLDS_KEY = 'of.manhattan.navigation.folded';

/** The right navigation's collapse, its own preference (the left sidebar keeps the core's key). */
const NAV_MINIMIZED_STORAGE_KEY = 'of.manhattan.navigation.minimized';
const NAV_MINIMIZED_EVENT = 'of:manhattan-navigation-minimized';

function readNavMinimized(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(NAV_MINIMIZED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function subscribeNavMinimized(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === NAV_MINIMIZED_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(NAV_MINIMIZED_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(NAV_MINIMIZED_EVENT, listener);
  };
}

const expandedOnServer = () => false;

/**
 * `[collapsed, setCollapsed]` for the right navigation (`NavigationSidebarConfig.collapsed`
 * / `onCollapsedChange`), persisted per viewer. Read through `useSyncExternalStore`, so
 * the server and the hydrating client both draw it expanded and the stored choice
 * arrives on the render after.
 */
export function useManhattanNavCollapsed(): readonly [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribeNavMinimized, readNavMinimized, expandedOnServer);
  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(NAV_MINIMIZED_STORAGE_KEY, String(next));
    } catch {
      // Storage refused: the event below still moves this page's readers.
    }
    window.dispatchEvent(new Event(NAV_MINIMIZED_EVENT));
  }, []);
  return [collapsed, setCollapsed] as const;
}
