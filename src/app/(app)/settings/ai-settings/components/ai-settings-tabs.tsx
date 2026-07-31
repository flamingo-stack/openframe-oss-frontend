'use client';

import {
  ChatsIcon,
  MingoMonochromeIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type TabItem, TabNavigation } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useMemo } from 'react';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';

export const AI_SETTINGS_TAB_IDS = ['mingo', 'customer', 'guardrails'] as const;
export type AiSettingsTabId = (typeof AI_SETTINGS_TAB_IDS)[number];

export const AI_SETTINGS_TABS: TabItem[] = [
  { id: 'mingo', label: 'Mingo AI Chat', icon: MingoMonochromeIcon },
  { id: 'customer', label: 'Default Customer AI Configuration', icon: ChatsIcon },
  { id: 'guardrails', label: 'Default Customer AI Guardrails', icon: ShieldCheckIcon },
];

/** The flags this tab set depends on, resolved reactively by the hook below. */
interface AiSettingsTabFlags {
  mingoAiChatSettings: boolean;
}

// Tabs gated behind server feature flags until each feature ships. Guardrails
// is always visible.
const TAB_FEATURE_FLAG: Partial<Record<AiSettingsTabId, (flags: AiSettingsTabFlags) => boolean>> = {
  // Temporarily always visible: the Customer AI Assistant tab is shown, while the
  // not-yet-released appearance customization it controls stays gated behind
  // `featureFlags.customerAiAssistantSettings` at its own call sites.
  customer: () => true,
  mingo: flags => flags.mingoAiChatSettings,
};

/**
 * Tabs visible for the current feature-flag state (server-driven).
 *
 * A hook, not a plain function: both call sites read it during render, and a
 * `featureFlags.*` snapshot taken before the flags query answers would pin the
 * tab set to the env defaults with nothing to recompute it.
 */
export function useVisibleAiSettingsTabs(): TabItem[] {
  const mingoAiChatSettings = useFeatureFlag('mingo-ai-chat-settings');

  return useMemo(() => {
    const flags: AiSettingsTabFlags = { mingoAiChatSettings };
    return AI_SETTINGS_TABS.filter(tab => {
      const gate = TAB_FEATURE_FLAG[tab.id as AiSettingsTabId];
      return !gate || gate(flags);
    });
  }, [mingoAiChatSettings]);
}

interface AiSettingsTabsProps {
  activeTab: AiSettingsTabId;
  onTabChange: (id: AiSettingsTabId) => void;
  children: (activeTab: AiSettingsTabId) => ReactNode;
}

export function AiSettingsTabs({ activeTab, onTabChange, children }: AiSettingsTabsProps) {
  const tabs = useVisibleAiSettingsTabs();

  return (
    <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={tabId => onTabChange(tabId as AiSettingsTabId)}>
      {activeId => <div className="pt-[var(--spacing-system-l)]">{children(activeId as AiSettingsTabId)}</div>}
    </TabNavigation>
  );
}
