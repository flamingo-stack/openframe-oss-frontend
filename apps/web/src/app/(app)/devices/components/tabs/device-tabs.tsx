'use client';

import {
  AddressBookIcon,
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
import { createContext, useContext } from 'react';
import { useTenantManagementV2Gate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { useIncidentsGate } from '@/app/(app)/incidents/hooks/use-incidents-gate';
import { AssignedArticlesTab } from '@/app/(app)/knowledge-base/components/assigned-articles/assigned-articles-tab';
import { deviceArticlesTarget } from '@/app/(app)/knowledge-base/components/assigned-articles/assigned-articles-target';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import type { DeviceDetailTab } from '@/lib/routes';
import { useSessionRecordingsGate } from '../../hooks/use-session-recordings-gate';
import type { Device } from '../../types/device.types';
import { AgentsTab } from './agents-tab';
import { DeviceLogsTab } from './device-logs/device-logs-tab';
import { DirectoryTab } from './directory-tab';
import { DirectoryUsersTab } from './directory-users-tab';
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
  return (
    <LoadingWhen loading={!device?.machineId}>
      <AssignedArticlesTab target={device?.machineId ? deviceArticlesTarget(device.machineId) : null} />
    </LoadingWhen>
  );
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

/**
 * The page's one read of `useDirectoryGate`, so that the tab bar and the tab under it cannot disagree. A tab mounts per
 * open; with its own read it would draw a loading form each time, however settled the answer. Off without a provider:
 * the local accounts.
 */
export const DeviceDirectoryGateContext = createContext<FeatureFlagGate>('off');

/**
 * Directory users where the tenant has directories (D30), the machine's local accounts where it has none. While the
 * flags are read, the local accounts in their loading form: with `tenant-management-v2` off (stage, prod) that is the
 * answer, and its tab is what main draws. Once phase 2 is on, the synced-connection count is what is out, and the
 * directory users wait in their loading form, since most such tenants have a directory.
 */
function GatedUsersTab({ device }: { device: Device | null }) {
  const gate = useContext(DeviceDirectoryGateContext);
  const phase2 = useTenantManagementV2Gate();
  if (phase2 === 'on' && gate !== 'off') {
    return (
      <LoadingWhen loading={gate === 'loading'}>
        <DirectoryUsersTab device={device} />
      </LoadingWhen>
    );
  }
  return (
    <LoadingWhen loading={gate === 'loading'}>
      <UsersTab device={device} />
    </LoadingWhen>
  );
}

function GatedDirectoryTab({ device }: { device: Device | null }) {
  return (
    <LoadingWhen loading={useContext(DeviceDirectoryGateContext) === 'loading'}>
      <DirectoryTab device={device} />
    </LoadingWhen>
  );
}

// `satisfies` links each gated id to the route registry's tab union — renaming it in
// TAB_IDS.deviceDetails without updating this fails tsc.
export const REMOTE_SESSIONS_TAB_ID = 'remote-sessions' satisfies DeviceDetailTab;
const INCIDENTS_TAB_ID = 'incidents' satisfies DeviceDetailTab;
const DEVICE_LOGS_TAB_ID = 'device-logs' satisfies DeviceDetailTab;
const DIRECTORY_TAB_ID = 'directory' satisfies DeviceDetailTab;

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
    component: GatedUsersTab,
  },
  {
    id: DIRECTORY_TAB_ID,
    label: 'Directory',
    icon: AddressBookIcon,
    component: GatedDirectoryTab,
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
 * tenants have the feature) and its panel draws its loading form. Directory is
 * Tenant Management Phase 2's, which stage and prod run without: while the flags
 * are read it is absent and a link to it falls back to Overview, and once phase 2
 * is on it keeps its place while the synced-connection count is out.
 */
export function useDeviceTabs(directoryGate: FeatureFlagGate): TabItem[] {
  const recordingsGate = useSessionRecordingsGate();
  const incidentsGate = useIncidentsGate();
  const phase2 = useTenantManagementV2Gate();
  return ALL_DEVICE_TABS.filter(
    tab =>
      (tab.id !== REMOTE_SESSIONS_TAB_ID || recordingsGate !== 'off') &&
      (tab.id !== INCIDENTS_TAB_ID || incidentsGate !== 'off') &&
      (tab.id !== DIRECTORY_TAB_ID || (phase2 === 'on' && directoryGate !== 'off')),
  );
}
