'use client';

import { useSyncExternalStore } from 'react';
import { readSidebarMinimized, subscribeSidebarMinimized, writeSidebarMinimized } from '@/lib/navigation-sidebar-state';

const expandedOnServer = () => false;

/**
 * The desktop sidebar's collapse, owned by the shell: `[collapsed, setCollapsed]` for
 * `NavigationSidebarConfig.collapsed` / `onCollapsedChange`. Controlled so ⌘K can
 * reveal a collapsed sidebar; persisted under the core sidebar's own key, so the
 * pre-paint width seed and the classic shell read the same preference.
 */
export function useSidebarCollapsed(): readonly [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribeSidebarMinimized, readSidebarMinimized, expandedOnServer);
  return [collapsed, writeSidebarMinimized] as const;
}
