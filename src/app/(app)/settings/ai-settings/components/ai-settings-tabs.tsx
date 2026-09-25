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
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';

export const AI_SETTINGS_TAB_IDS = ['mingo', 'customer', 'guardrails', 'device-guardrails'] as const;
export type AiSettingsTabId = (typeof AI_SETTINGS_TAB_IDS)[number];

export const AI_SETTINGS_TABS: TabItem[] = [
  { id: 'mingo', label: 'Mingo AI Chat', icon: MingoMonochromeIcon },
  { id: 'customer', label: 'Default Customer AI Configuration', icon: ChatsIcon },
  { id: 'guardrails', label: 'Default Customer AI Guardrails', icon: ShieldCheckIcon },
  { id: 'device-guardrails', label: 'Device Guardrails', icon: MonitorShieldIcon },
];

/** The flags this tab set depends on, resolved reactively by the hook below. */
interface AiSettingsTabFlags {
  mingoAiChatSettings: boolean;
  remoteAccessApproval: boolean;
}

// Tabs gated behind server feature flags until each feature ships. Guardrails
// is always visible.
const TAB_FEATURE_FLAG: Partial<Record<AiSettingsTabId, (flags: AiSettingsTabFlags) => boolean>> = {
  // Temporarily always visible: the Customer AI Assistant tab is shown, while the
  // not-yet-released appearance customization it controls stays gated behind
  // `featureFlags.customerAiAssistantSettings` at its own call sites.
  customer: () => true,
  mingo: flags => flags.mingoAiChatSettings,
  // Remote access policy ships dark with the approval flow flag.
  'device-guardrails': flags => flags.remoteAccessApproval,
};

/**
 * Tabs visible for the current feature-flag state (server-driven), or `null`
 * until every flag that shapes the set has answered.
 *
 * `null` rather than a partial set: the page picks its starting tab from this
 * once, so a set read before the flags answer (flag-gated tabs missing) would
 * send a `?tab=device-guardrails` link, or the default landing on Mingo, to the
 * wrong tab for good.
 */
export function useVisibleAiSettingsTabs(): TabItem[] | null {
  const mingoAiChatSettings = useFeatureFlagGate('mingo-ai-chat-settings');
  // Dev builds bypass this flag; see the gate.
  const remoteAccessApproval = useRemoteAccessApprovalGate();

  return useMemo(() => {
    if (mingoAiChatSettings === 'loading' || remoteAccessApproval === 'loading') return null;
    const flags: AiSettingsTabFlags = {
      mingoAiChatSettings: mingoAiChatSettings === 'on',
      remoteAccessApproval: remoteAccessApproval === 'on',
    };
    return AI_SETTINGS_TABS.filter(tab => {
      const gate = TAB_FEATURE_FLAG[tab.id as AiSettingsTabId];
      return !gate || gate(flags);
    });
  }, [mingoAiChatSettings, remoteAccessApproval]);
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
