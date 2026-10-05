'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { SettingsTab } from '@/lib/routes';
import { SettingsTabContent } from './settings-tab-content';
import { getSettingsTabs, SettingsTabNavigation } from './tabs';

type TabId = SettingsTab;

const DEFAULT_TAB: TabId = 'ai-settings';
const TAB_PARAM = 'tab';
//TODO: delete if component is redundant
export function SettingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const validTabIds = useMemo(() => new Set(getSettingsTabs().map(t => t.id)), []);

  const urlTab = useMemo<TabId>(() => {
    const fromUrl = (searchParams?.get(TAB_PARAM) || '').toLowerCase();
    return validTabIds.has(fromUrl) ? (fromUrl as TabId) : DEFAULT_TAB;
  }, [searchParams, validTabIds]);

  // The URL is the source of truth; local state exists only so a click paints the
  // new tab before the router round-trip lands. Reconciled DURING render (the
  // adjusting-state-on-prop-change pattern) rather than in an effect: an effect
  // renders the old tab once, and then a second time — a visible flash of the
  // previous panel on every back/forward navigation.
  const [activeTab, setActiveTab] = useState<TabId>(urlTab);
  const [lastUrlTab, setLastUrlTab] = useState<TabId>(urlTab);
  if (urlTab !== lastUrlTab) {
    setLastUrlTab(urlTab);
    setActiveTab(urlTab);
  }

  const handleTabChange = (tabId: string) => {
    const next = tabId as TabId;
    setActiveTab(next);

    const params = new URLSearchParams(searchParams?.toString());
    params.set(TAB_PARAM, next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex w-full flex-col">
      <SettingsTabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      <SettingsTabContent activeTab={activeTab} />
    </div>
  );
}
