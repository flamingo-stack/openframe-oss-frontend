'use client';

import {
  AlertTriangleIcon,
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
import type { TabItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useIncidentsGate } from '@/app/(app)/incidents/hooks/use-incidents-gate';
import type { DeviceDetailTab } from '@/lib/routes';
import { useDeviceAgentLogsGate } from '../../hooks/use-device-agent-logs-gate';
import { useSessionRecordingsGate } from '../../hooks/use-session-recordings-gate';
import { AGENT_LOGS_TAB_ID, listsAgentLogsTab } from '../../utils/device-tab-gates';
import { AgentLogsTab } from './agent-logs/agent-logs-tab';
import { AgentsTab } from './agents-tab';
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

// `satisfies` links each gated id to the route registry's tab union — renaming it in
// TAB_IDS.deviceDetails without updating this fails tsc.
export const REMOTE_SESSIONS_TAB_ID = 'remote-sessions' satisfies DeviceDetailTab;
const INCIDENTS_TAB_ID = 'incidents' satisfies DeviceDetailTab;

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
    component: IncidentsTab,
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
    id: REMOTE_SESSIONS_TAB_ID,
    label: 'Remote Sessions',
    // The Figma glyph is named "computer-mouse" - the same icon the Remote
    // Control header button uses.
    icon: ComputerMouseIcon,
    component: RemoteSessionsTab,
  },
  {
    // Last in the bar; the same glyph as the "Device Logs" menu entry.
    id: AGENT_LOGS_TAB_ID,
    label: 'Agent Logs',
    icon: ClipboardListIcon,
    component: AgentLogsTab,
  },
];

/**
 * Tabs shown for a device. Remote Sessions is gated on the session recordings
 * gate (same pattern as `getCustomerTabs`), Incidents on the Incidents page's gate.
 * 'loading' and 'off' both hide a tab, so it only ever appears when the feature
 * is actually on. Agent Logs is the one exception: while its flag loads it stays
 * listed for the deep link that asked for it, so the page and its skeleton show
 * the same tab bar (`listsAgentLogsTab`).
 */
export function useDeviceTabs(requestedTab: string): TabItem[] {
  const recordingsGate = useSessionRecordingsGate();
  const incidentsGate = useIncidentsGate();
  const agentLogsGate = useDeviceAgentLogsGate();
  return ALL_DEVICE_TABS.filter(
    tab =>
      (tab.id !== REMOTE_SESSIONS_TAB_ID || recordingsGate === 'on') &&
      (tab.id !== INCIDENTS_TAB_ID || incidentsGate === 'on') &&
      (tab.id !== AGENT_LOGS_TAB_ID || listsAgentLogsTab(agentLogsGate, requestedTab)),
  );
}
