'use client';

import {
  AlertTriangleIcon,
  BookBookmarkIcon,
  // BracketCurlyEllipsisVrIcon, // Queries tab temporarily disabled
  BracketSquareCheckIcon,
  ClipboardListIcon,
  ComputerMouseIcon,
  FolderShieldIcon,
  HardDrivesIcon,
  Hierarchy02Icon,
  Menu02Icon,
  ShieldIcon,
  TagIcon,
  TerminalBrowserIcon,
  TerminalMonitorIcon,
  UsersIcon,
  WebDesignIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, type TabItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useIncidentsGate } from '@/app/(app)/incidents/hooks/use-incidents-gate';
import { AssignedArticlesTab } from '@/app/(app)/knowledge-base/components/assigned-articles/assigned-articles-tab';
import { deviceArticlesTarget } from '@/app/(app)/knowledge-base/components/assigned-articles/assigned-articles-target';
import type { DeviceDetailTab } from '@/lib/routes';
import { useSessionRecordingsGate } from '../../hooks/use-session-recordings-gate';
import type { Device } from '../../types/device.types';
import { AgentsTab } from './agents-tab';
import { DeviceLogsTab } from './device-logs/device-logs-tab';
import { HardwareTab } from './hardware-tab';
import { IncidentsTab } from './incidents-tab';
import { NetworkTab } from './network-tab';
import { OsTab } from './os-tab';
import { OverviewTab } from './overview-tab';
import { PoliciesTab } from './policies-tab';
// import { QueriesTab } from './queries-tab'; // Queries tab temporarily disabled
import { RemoteSessionsTab } from './remote-sessions-tab';
import { SecurityTab } from './security-tab';
import { SoftwareTab } from './software-tab';
import { TicketsTab } from './tickets-tab';
import { UsersTab } from './users-tab';
import { VulnerabilitiesTab } from './vulnerabilities-tab';

// Module-level, so its identity is stable across renders (TabContent would remount the tab otherwise).
function ArticlesTab({ device }: { device: Device | null }) {
  if (!device?.machineId) return null;
  return <AssignedArticlesTab target={deviceArticlesTarget(device.machineId)} />;
}

// The gated tabs, module-level for a stable identity: while the gate is read the tab is shown and its panel draws its
// loading form (always mounted, so nothing remounts when the gate answers); 'off' removes the tab in `useDeviceTabs`.
function GatedIncidentsTab({ device }: { device: Device | null }) {
  return (
    <LoadingWhen loading={useIncidentsGate() === 'loading'}>
      <IncidentsTab device={device} />
    </LoadingWhen>
  );
}

function GatedRemoteSessionsTab({ device }: { device: Device | null }) {
  return (
    <LoadingWhen loading={useSessionRecordingsGate() === 'loading'}>
      <RemoteSessionsTab device={device} />
    </LoadingWhen>
  );
}

// `satisfies` links each gated id to the route registry's tab union — renaming it in
// TAB_IDS.deviceDetails without updating this fails tsc.
export const REMOTE_SESSIONS_TAB_ID = 'remote-sessions' satisfies DeviceDetailTab;
const INCIDENTS_TAB_ID = 'incidents' satisfies DeviceDetailTab;
const DEVICE_LOGS_TAB_ID = 'device-logs' satisfies DeviceDetailTab;

/** Every tab, gated ones included — `useDeviceTabs` narrows it to the visible set. */
export const ALL_DEVICE_TABS: TabItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Menu02Icon,
    component: OverviewTab,
  },
  {
    id: 'vulnerabilities',
    label: 'Vulnerabilities',
    icon: BracketSquareCheckIcon,
    component: VulnerabilitiesTab,
  },
  {
    id: INCIDENTS_TAB_ID,
    label: 'Incidents',
    icon: AlertTriangleIcon,
    component: GatedIncidentsTab,
  },
  {
    id: 'policies',
    label: 'Policies',
    icon: FolderShieldIcon,
    component: PoliciesTab,
  },
  // Queries tab temporarily disabled.
  // {
  //   id: 'queries',
  //   label: 'Queries',
  //   icon: BracketCurlyEllipsisVrIcon,
  //   component: QueriesTab,
  // },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldIcon,
    component: SecurityTab,
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: TerminalBrowserIcon,
    component: AgentsTab,
  },
  {
    id: 'tickets',
    label: 'Tickets',
    icon: TagIcon,
    component: TicketsTab,
  },
  {
    id: 'hardware',
    label: 'Hardware',
    icon: HardDrivesIcon,
    component: HardwareTab,
  },
  {
    id: 'os',
    label: 'OS',
    icon: TerminalMonitorIcon,
    component: OsTab,
  },
  {
    id: 'network',
    label: 'Network',
    icon: Hierarchy02Icon,
    component: NetworkTab,
  },
  {
    id: 'users',
    label: 'Users',
    icon: UsersIcon,
    component: UsersTab,
  },
  {
    id: 'software',
    label: 'Software',
    icon: WebDesignIcon,
    component: SoftwareTab,
  },
  {
    id: DEVICE_LOGS_TAB_ID,
    label: 'Device Logs',
    icon: ClipboardListIcon,
    // Shipped behind its flag — the same stamp the sidebar puts on flagged modules.
    badge: 'Beta',
    component: DeviceLogsTab,
  },
  {
    id: REMOTE_SESSIONS_TAB_ID,
    label: 'Remote Sessions',
    // The Figma glyph is named "computer-mouse" - the same icon the Remote
    // Control header button uses.
    icon: ComputerMouseIcon,
    component: GatedRemoteSessionsTab,
  },
  {
    id: 'assigned-articles',
    label: 'Assigned Articles',
    icon: BookBookmarkIcon,
    component: ArticlesTab,
  },
];

/**
 * Tabs shown for a device. Remote Sessions is gated on the session recordings
 * gate (same pattern as `getCustomerTabs`), Incidents on the Incidents page's gate.
 * Only 'off' hides a tab: while a gate is read the tab keeps its place (most
 * tenants have the feature) and its panel draws its loading form.
 */
export function useDeviceTabs(): TabItem[] {
  const recordingsGate = useSessionRecordingsGate();
  const incidentsGate = useIncidentsGate();
  return ALL_DEVICE_TABS.filter(
    tab =>
      (tab.id !== REMOTE_SESSIONS_TAB_ID || recordingsGate !== 'off') &&
      (tab.id !== INCIDENTS_TAB_ID || incidentsGate !== 'off'),
  );
}
