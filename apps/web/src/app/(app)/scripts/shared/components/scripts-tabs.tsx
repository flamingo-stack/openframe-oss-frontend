'use client';

import { TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { SCRIPTS_TABS, type ScriptsTabId } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useManhattanDock } from '@/app/components/manhattan-shell/manhattan-dock-context';
import { routes } from '@/lib/routes';

interface ScriptsTabNavigationProps {
  activeTab: ScriptsTabId;
}

/**
 * Top-level switcher between the two Scripts pages. They are separate routes,
 * not `?tab=` views of one page, so this is pure navigation — no tab state and
 * no tab-owned components. None in the Manhattan v2 shell: its navigation lists both.
 */
export function ScriptsTabNavigation({ activeTab }: ScriptsTabNavigationProps) {
  const router = useRouter();
  const inNavigation = useManhattanDock();

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return;
      router.push(tabId === 'schedules' ? routes.scripts.schedules.list : routes.scripts.list);
    },
    [activeTab, router],
  );

  if (inNavigation) return null;
  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation urlSync={false} activeTab={activeTab} tabs={SCRIPTS_TABS} onTabChange={handleTabChange} />
    </div>
  );
}
