'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { BracketCurlyIcon, TimerIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { TabBarSkeleton } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { routes } from '@/lib/routes';
import { SCRIPTS_TAB_WIDTHS } from './scripts-table-columns';

const SCRIPTS_TABS: TabItem[] = [
  { id: 'list', label: 'Scripts List', icon: BracketCurlyIcon },
  { id: 'schedules', label: 'Scripts Schedules', icon: TimerIcon },
];

interface ScriptsTabNavigationProps {
  activeTab: 'list' | 'schedules';
}

/**
 * Top-level switcher between the two Scripts pages. They are separate routes,
 * not `?tab=` views of one page, so this is pure navigation — no tab state and
 * no tab-owned components.
 *
 * The Schedules view (tab + `/scripts/schedules/*` routes) is gated by the
 * `script-schedules` flag. When it's off the switcher collapses to a single
 * view (Scripts List), so the whole tab bar is hidden rather than rendering a
 * lone tab — the schedules routes themselves redirect away (see
 * `schedules/layout.tsx`).
 *
 * Before the flag answers the bar renders as a SKELETON rather than guessing.
 * Guessing "off" hid a bar the tenant does have and dropped it in late; guessing
 * "on" showed a tab that must not exist. A skeleton is the only honest answer, and
 * it keeps the bar's height reserved either way, so the page below it doesn't jump
 * when the answer lands.
 */
export function ScriptsTabNavigation({ activeTab }: ScriptsTabNavigationProps) {
  const router = useRouter();

  // Same gate as the schedules layout and the page skeleton, so tab bar, route
  // and placeholder can't disagree for a frame.
  const schedules = useFeatureFlagGate('script-schedules');

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return;
      router.push(tabId === 'schedules' ? routes.scripts.schedules.list : routes.scripts.list);
    },
    [activeTab, router],
  );

  if (schedules === 'off') {
    return null;
  }

  return (
    <div className="px-[var(--spacing-system-l)]">
      {schedules === 'loading' ? (
        <TabBarSkeleton widths={SCRIPTS_TAB_WIDTHS} />
      ) : (
        <TabNavigation urlSync={false} activeTab={activeTab} tabs={SCRIPTS_TABS} onTabChange={handleTabChange} />
      )}
    </div>
  );
}
