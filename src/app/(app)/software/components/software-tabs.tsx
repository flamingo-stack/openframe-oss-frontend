'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import {
  Parcel02Icon,
  Refresh02HrIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { routes } from '@/lib/routes';

/** The three Software views. Ids double as the switcher's `activeTab` values. */
export type SoftwareTabId = 'all' | 'updates' | 'vulnerabilities';

const SOFTWARE_TABS: TabItem[] = [
  { id: 'all', label: 'All Software', icon: Parcel02Icon },
  { id: 'updates', label: 'Software Update', icon: Refresh02HrIcon },
  { id: 'vulnerabilities', label: 'Vulnerabilities', icon: ShieldCheckIcon },
];

const ROUTE_BY_TAB: Record<SoftwareTabId, string> = {
  all: routes.software.list,
  updates: routes.software.updates,
  vulnerabilities: routes.software.vulnerabilities,
};

interface SoftwareTabNavigationProps {
  activeTab: SoftwareTabId;
}

/**
 * Top-level switcher between the three Software pages. They are separate routes,
 * not `?tab=` views of one page, so this is pure navigation — no tab state and
 * no tab-owned components.
 */
export function SoftwareTabNavigation({ activeTab }: SoftwareTabNavigationProps) {
  const router = useRouter();

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return;
      router.push(ROUTE_BY_TAB[tabId as SoftwareTabId] ?? routes.software.list);
    },
    [activeTab, router],
  );

  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation urlSync={false} activeTab={activeTab} tabs={SOFTWARE_TABS} onTabChange={handleTabChange} />
    </div>
  );
}
