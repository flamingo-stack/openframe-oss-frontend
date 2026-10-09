'use client';

import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core';
import { ComputerMouseIcon, MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { routes } from '@/lib/routes';
import { useSessionRecordingsGate } from '../hooks/use-session-recordings-gate';

type DevicesPageTab = 'list' | 'remote-sessions';

/** The Remote Sessions tab's name, as Figma 2539-21701 draws it. */
export const REMOTE_SESSIONS_PAGE_TITLE = 'Remote Sessions Recordings';

const DEVICES_PAGE_TABS: TabItem[] = [
  { id: 'list', label: 'Devices List', icon: MonitorIcon },
  // The same glyph the device's own Remote Sessions tab uses.
  { id: 'remote-sessions', label: REMOTE_SESSIONS_PAGE_TITLE, icon: ComputerMouseIcon },
];

/**
 * The Devices page's tabs: the device list and the tenant's remote sessions.
 * Separate routes, so this is pure navigation. Shown only where session
 * recordings are on - elsewhere the Devices page has no second tab and keeps
 * its plain header.
 */
export function DevicesTabNavigation({ activeTab }: { activeTab: DevicesPageTab }) {
  const router = useRouter();
  const gate = useSessionRecordingsGate();

  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return;
      router.push(tabId === 'remote-sessions' ? routes.devices.remoteSessions : routes.devices.list);
    },
    [activeTab, router],
  );

  if (gate !== 'on') return null;
  return (
    <div className="px-[var(--spacing-system-l)]">
      <TabNavigation urlSync={false} activeTab={activeTab} tabs={DEVICES_PAGE_TABS} onTabChange={handleTabChange} />
    </div>
  );
}
