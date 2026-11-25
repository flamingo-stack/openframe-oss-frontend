import type { ReactNode } from 'react';
import { TabEmptyState } from './tab-empty-state';

/**
 * Data tabs fed by Fleet when the device's OS is below Fleet's minimum and no Fleet connection is live: the section
 * will never fill on this OS version, so the copy says why and how it changes instead of "still deploying". The same
 * text on every tab, per design; the tab's own icon.
 */
export function TabUnsupportedEmptyState({ icon }: { icon: ReactNode }) {
  return (
    <TabEmptyState
      icon={icon}
      title="Not available on this macOS version"
      description="Upgrade macOS and Fleet installs automatically."
    />
  );
}
