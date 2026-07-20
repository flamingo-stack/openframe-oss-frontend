'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { BracketCurlyIcon, TimerIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { routes } from '@/lib/routes';

const SCRIPTS_V2_TABS: TabItem[] = [
  { id: 'list', label: 'Scripts List', icon: BracketCurlyIcon },
  { id: 'schedules', label: 'Scripts Schedules', icon: TimerIcon },
];

interface ScriptsV2TabNavigationProps {
  activeTab: 'list' | 'schedules';
}

/**
 * Top-level switcher between the scripts-v2 pages. Unlike the legacy
 * `/scripts?tab=` page, the v2 tabs are separate routes, so this is pure
 * navigation — no `?tab=` state and no tab-owned components.
 */
export function ScriptsV2TabNavigation({ activeTab }: ScriptsV2TabNavigationProps) {
  const router = useRouter();

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return;
      router.push(tabId === 'schedules' ? routes.scriptsV2.schedules.list : routes.scriptsV2.list);
    },
    [activeTab, router],
  );

  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation urlSync={false} activeTab={activeTab} tabs={SCRIPTS_V2_TABS} onTabChange={handleTabChange} />
    </div>
  );
}
