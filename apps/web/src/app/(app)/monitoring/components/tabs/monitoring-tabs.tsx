'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import {
  BracketCurlyEllipsisVrIcon,
  FolderShieldIcon,
  SlidersIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useManhattanDock } from '@/app/components/manhattan-shell/manhattan-dock-context';
import { useChecksGate } from '../../checks/hooks/use-checks-gate';
import { Checks } from './checks';
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
  {
    id: 'checks',
    label: 'Checks',
    icon: SlidersIcon,
    component: Checks,
  },
];

/** The Queries page's own pair: Checks sits beside Queries, where the navigation's Queries entry lands. */
const QUERIES_PAGE_TABS = MONITORING_TABS.filter(tab => tab.id !== 'policies');

/** The tabs this session may open: Checks only while the check settings are served (`useChecksGate`). */
export function useMonitoringTabs(): TabItem[] {
  const checksGate = useChecksGate();
  return checksGate === 'on' ? MONITORING_TABS : MONITORING_TABS.filter(tab => tab.id !== 'checks');
}

interface MonitoringTabNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

/**
 * The Policies / Queries / Checks tab bar. In the Manhattan v2 shell its navigation lists Policies and
 * Queries, so the bar is only the Queries page's own Queries / Checks pair.
 */
export function MonitoringTabNavigation({ activeTab, onTabChange }: MonitoringTabNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inNavigation = useManhattanDock();
  const tabs = useMonitoringTabs();

  const defaultHandleTabChange = useCallback(
    (tabId: string) => {
      router.replace(`${pathname}?tab=${tabId}`);
    },
    [router, pathname],
  );

  const handleTabChange = onTabChange || defaultHandleTabChange;

  const pageTabs = inNavigation ? tabs.filter(tab => QUERIES_PAGE_TABS.includes(tab)) : tabs;
  const onQueriesPage = activeTab === 'queries' || activeTab === 'checks';
  if (inNavigation && (!onQueriesPage || pageTabs.length < 2)) return null;
  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation
        urlSync={false}
        activeTab={activeTab || 'policies'}
        tabs={pageTabs}
        onTabChange={handleTabChange}
      />
    </div>
  );
}
