'use client';

import { useSyncExternalStore } from 'react';
import {
  MANHATTAN_NAVIGATION_EXPANDED_WIDTH,
  readManhattanNavCollapsed,
  subscribeManhattanNavCollapsed,
  writeManhattanNavCollapsed,
} from '@/lib/navigation-sidebar-state';

export { MANHATTAN_NAVIGATION_EXPANDED_WIDTH };
/** Where the right navigation keeps the sections the user folded. */
export const MANHATTAN_NAVIGATION_FOLDS_KEY = 'of.manhattan.navigation.folded';

/** Open on the server and through hydration, as on a first visit: the pre-paint seed sets the width the store answers. */
const expandedOnServer = () => false;

/**
 * The right navigation's collapse: `[collapsed, setCollapsed]` for `NavigationSidebarConfig.collapsed` /
 * `onCollapsedChange`. By default open from 1280px (beside the open chats sidebar) and the rail narrower
 * (`MANHATTAN_NAV_OPEN_FROM_WIDTH`); below 912px the top bar opens it as a drawer whatever this says. The user's
 * choice, once made, is kept, as the left sidebar's is. Its navigation and phone menu read the same value.
 */
export function useManhattanNavCollapsed(): readonly [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribeManhattanNavCollapsed, readManhattanNavCollapsed, expandedOnServer);
  return [collapsed, writeManhattanNavCollapsed] as const;
}
