'use client';

import { getTabComponent } from '@flamingo-stack/openframe-frontend-core';
import { SETTINGS_TABS } from './tabs';

interface SettingsTabContentProps {
  activeTab: string;
}

export function SettingsTabContent({ activeTab }: SettingsTabContentProps) {
  const TabComponent = getTabComponent(SETTINGS_TABS, activeTab);

  if (!TabComponent) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h3 className="mb-2 text-ods-text-primary text-h3">Tab Not Found</h3>
          <p className="text-ods-text-secondary">The selected tab &quot;{activeTab}&quot; could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[400px]">
      <TabComponent />
    </div>
  );
}
