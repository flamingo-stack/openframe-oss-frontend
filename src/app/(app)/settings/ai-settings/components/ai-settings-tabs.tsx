'use client';

import {
  ChatsIcon,
  MingoMonochromeIcon,
  MonitorShieldIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useMemo } from 'react';
import { useRemoteAccessApprovalGate } from '@/app/(app)/devices/hooks/use-remote-access-approval-gate';

export const AI_SETTINGS_TAB_IDS = ['mingo', 'customer', 'guardrails', 'device-guardrails'] as const;
export type AiSettingsTabId = (typeof AI_SETTINGS_TAB_IDS)[number];

export const AI_SETTINGS_TABS: TabItem[] = [
  { id: 'mingo', label: 'Mingo AI Chat', icon: MingoMonochromeIcon },
  { id: 'customer', label: 'Default Customer AI Configuration', icon: ChatsIcon },
  { id: 'guardrails', label: 'Default Customer AI Guardrails', icon: ShieldCheckIcon },
  { id: 'device-guardrails', label: 'Device Guardrails', icon: MonitorShieldIcon },
];

/**
 * Tabs visible for the current feature-flag state (server-driven), or `null`
 * until `remote-access-approval`, the one flag that shapes the set, has answered.
 *
 * `null` rather than a partial set: the page picks its starting tab from this
 * once, so a set read before the flag answers (device-guardrails tab missing) would
 * send a `?tab=device-guardrails` link to the wrong tab for good.
 */
export function useVisibleAiSettingsTabs(): TabItem[] | null {
  // Dev builds bypass this flag; see the gate.
  const remoteAccessApproval = useRemoteAccessApprovalGate();

  return useMemo(() => {
    if (remoteAccessApproval === 'loading') return null;
    // Remote access policy ships dark with the approval flow flag.
    if (remoteAccessApproval === 'on') return AI_SETTINGS_TABS;
    return AI_SETTINGS_TABS.filter(tab => tab.id !== 'device-guardrails');
  }, [remoteAccessApproval]);
}

interface AiSettingsTabsProps {
  tabs: TabItem[];
  activeTab: AiSettingsTabId;
  onTabChange: (id: AiSettingsTabId) => void;
  children: (activeTab: AiSettingsTabId) => ReactNode;
}

export function AiSettingsTabs({ tabs, activeTab, onTabChange, children }: AiSettingsTabsProps) {
  return (
    <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={tabId => onTabChange(tabId as AiSettingsTabId)}>
      {activeId => <div className="pt-[var(--spacing-system-l)]">{children(activeId as AiSettingsTabId)}</div>}
    </TabNavigation>
  );
}
