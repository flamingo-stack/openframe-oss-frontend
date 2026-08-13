'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import {
  BracketCurlyEllipsisVrIcon,
  FolderShieldIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';

// The tab bodies take page-owned search props, so the page renders them directly
// rather than through `getTabComponent`; this list drives only the nav buttons.
export const MONITORING_TABS: TabItem[] = [
  {
    id: 'policies',
    label: 'Policies',
    icon: FolderShieldIcon,
  },
  {
    id: 'queries',
    label: 'Queries',
    icon: BracketCurlyEllipsisVrIcon,
  },
];

interface MonitoringTabNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function MonitoringTabNavigation({ activeTab, onTabChange }: MonitoringTabNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const defaultHandleTabChange = useCallback(
    (tabId: string) => {
      router.replace(`${pathname}?tab=${tabId}`);
    },
    [router, pathname],
  );

  const handleTabChange = onTabChange || defaultHandleTabChange;

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
