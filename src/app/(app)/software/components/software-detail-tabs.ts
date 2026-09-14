import { MonitorIcon, ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { TabItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentType } from 'react';
import type { SoftwareDetailTab } from '@/lib/routes';
import { type SoftwareTabProps, SoftwareDevicesTab } from './software-devices-tab';
import { SoftwareVulnerabilitiesTab } from './software-vulnerabilities-tab';

/**
 * The Software detail tabs: label, icon and BODY, one entry per tab.
 *
 * The body travels with the tab (the core `TabItem`'s own `component` field,
 * resolved through {@link softwareTabBody}), so the page never learns the ids —
 * the same shape the script and customer detail pages use. Each body is `memo`'d
 * at its export because `TabNavigation` DEFERS the body: one switch runs the
 * render prop twice, and again on every query-param change.
 */
export const SOFTWARE_DETAIL_TABS: TabItem[] = [
  { id: 'devices' satisfies SoftwareDetailTab, label: 'Devices', icon: MonitorIcon, component: SoftwareDevicesTab },
  {
    id: 'vulnerabilities' satisfies SoftwareDetailTab,
    label: 'Vulnerabilities',
    icon: ShieldCheckIcon,
    component: SoftwareVulnerabilitiesTab,
  },
];

/** What an absent or unrecognised `?tab=` resolves to — the first tab, as the strip reads. */
export const SOFTWARE_DEFAULT_TAB = SOFTWARE_DETAIL_TABS[0].id;

/** The body registered for `tabId`, falling back to the default tab's. */
export function softwareTabBody(tabId: string): ComponentType<SoftwareTabProps> {
  const tab = SOFTWARE_DETAIL_TABS.find(item => item.id === tabId) ?? SOFTWARE_DETAIL_TABS[0];
  return tab.component as ComponentType<SoftwareTabProps>;
}
