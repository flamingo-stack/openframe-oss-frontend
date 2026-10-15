'use client';

import { TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { SCRIPTS_TABS, type ScriptsTabId } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { routes } from '@/lib/routes';

interface ScriptsTabNavigationProps {
  activeTab: ScriptsTabId;
}

/**
 * Top-level switcher between the two Scripts pages. They are separate routes,
 * not `?tab=` views of one page, so this is pure navigation — no tab state and
 * no tab-owned components.
 */
export function ScriptsTabNavigation({ activeTab }: ScriptsTabNavigationProps) {
  const router = useRouter();

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return;
      router.push(tabId === 'schedules' ? routes.scripts.schedules.list : routes.scripts.list);
    },
    [activeTab, router],
  );

  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation urlSync={false} activeTab={activeTab} tabs={SCRIPTS_TABS} onTabChange={handleTabChange} />
    </div>
  );
}
