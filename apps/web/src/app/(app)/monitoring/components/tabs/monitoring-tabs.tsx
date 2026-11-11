'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import {
  BracketCurlyEllipsisVrIcon,
  FolderShieldIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useManhattanDock } from '@/app/components/manhattan-shell/manhattan-dock-context';
import { Policies } from './policies';
import { Queries } from './queries';

export const MONITORING_TABS: TabItem[] = [
  {
    id: 'policies',
    label: 'Policies',
    icon: FolderShieldIcon,
    component: Policies,
  },
  {
    id: 'queries',
    label: 'Queries',
    icon: BracketCurlyEllipsisVrIcon,
    component: Queries,
  },
];

interface MonitoringTabNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

/** The Policies / Queries tab bar. None in the Manhattan v2 shell: its navigation lists both. */
export function MonitoringTabNavigation({ activeTab, onTabChange }: MonitoringTabNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inNavigation = useManhattanDock();

  const defaultHandleTabChange = useCallback(
    (tabId: string) => {
      router.replace(`${pathname}?tab=${tabId}`);
    },
    [router, pathname],
  );

  const handleTabChange = onTabChange || defaultHandleTabChange;

  if (inNavigation) return null;
  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation
        urlSync={false}
        activeTab={activeTab || 'policies'}
        tabs={MONITORING_TABS}
        onTabChange={handleTabChange}
      />
    </div>
  );
}
