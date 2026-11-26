'use client';

import { InfoCard, type InfoCardData, Tag } from '@flamingo-stack/openframe-frontend-core';
import { ToolBadge } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ChocolateyLogoGreyIcon,
  HomebrewLogoGreyIcon,
  TerminalBrowserIcon,
  WingetLogoGreyIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingItems, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime, normalizeToolTypeWithFallback } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ComponentType, ReactNode } from 'react';
import { EMPTY_CARD } from '@/app/components/shared/info-card-loading';
import { PackageManagerType } from '@/generated/schema-enums';
import { isSaasTenantMode } from '@/lib/app-mode';
import { formatDateTime } from '@/lib/format-date';
import { parseInstant } from '@/lib/graphql-scalars';
import { useDevicePackageManagers } from '../../hooks/device-package-managers';
import type { Device, InstalledAgent, ToolConnection } from '../../types/device.types';
import { getAgentFooter } from '../../utils/agent-footer';
import { type PackageManagerCard, packageManagerCards } from '../../utils/package-manager-cards';
import {
  getExpectedAgentTypes,
  getToolConnectionDisplayStatus,
  getUnsupportedTool,
  type ToolConnectionDisplayStatus,
} from '../../utils/tool-connection-status';
import { TabEmptyState } from './tab-empty-state';

interface AgentsTabProps {
  device: Device;
}

const agentTypeToToolType: Record<string, string> = {
  'fleetmdm-agent': 'FLEET_MDM',
  'meshcentral-agent': 'MESHCENTRAL',
  'openframe-chat': 'OPENFRAME_CHAT',
  'openframe-client': 'OPENFRAME_CLIENT',
  osqueryd: 'OSQUERY',
};

/** The labels of an agent card's rows: static copy, read by the loaded card and by its loading form. */
const AGENT_ROW_LABELS = {
  agent: 'Agent',
  status: 'Status',
  lastSeen: 'Last Seen',
  id: 'ID',
  version: 'Version',
  updated: 'Updated',
} as const;

/** The agents that report a live status (their cards carry Status and Last Seen). */
const AGENT_TYPES_WITH_STATUS = new Set(['FLEET_MDM', 'MESHCENTRAL']);

/** The rows a connected, reporting agent's card shows: Status and Last Seen only for an agent with a live status. */
function agentRowLabels(toolType: string): string[] {
  const { agent, status, lastSeen, id, version, updated } = AGENT_ROW_LABELS;
  return AGENT_TYPES_WITH_STATUS.has(toolType)
    ? [agent, status, lastSeen, id, version, updated]
    : [agent, id, version, updated];
}

/**
 * The cards the tab draws while the device is read, in the loaded order. The agent list has no page size: a typical
 * device reports one card per agent type the platform knows, each with the rows that agent's loaded card shows and
 * its real footer.
 */
const AGENT_CARD_SKELETONS = Object.entries(agentTypeToToolType)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, toolType]) => ({ rows: agentRowLabels(toolType), title: false, footer: getAgentFooter(toolType) ?? false }));

function getAgentDisplayStatus(
  toolType: string,
  connection: ToolConnection | null | undefined,
): ToolConnectionDisplayStatus {
  switch (toolType) {
    case 'FLEET_MDM':
    case 'MESHCENTRAL':
      return getToolConnectionDisplayStatus(connection);
    default:
      return 'offline';
  }
}

function formatTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return d.getTime() > 0 ? formatDateTime(d) : undefined;
}

function formatRelative(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return d.getTime() > 0 ? formatRelativeTime(d) : undefined;
}

type CombinedAgent = {
  agentType: string;
  version: string | undefined;
  toolType: string;
  agentToolId: string | undefined;
  hasConnection: boolean;
  isPlaceholder: boolean;
  status: ToolConnectionDisplayStatus;
  lastSeen: string | undefined;
  lastFetched: string | undefined;
  updatedAt: string | undefined;
};

/** The agents that do not run where Fleet does not: osquery ships inside the Fleet agent, and Orbit starts it. */
const FLEET_BUNDLED_TOOL_TYPES = new Set(['FLEET_MDM', 'OSQUERY']);

/** One card per installed agent, tool connection and expected agent not reported yet, in a stable order. */
function combineAgents(device: Device): CombinedAgent[] {
  const toolConnections = Array.isArray(device?.toolConnections) ? device.toolConnections : [];
  const installedAgents = Array.isArray(device?.installedAgents) ? device.installedAgents : [];

  // An OS below Fleet's minimum: Fleet and the osquery it bundles show Not supported whatever their connection
  // says (a Fleet that still runs there is about to be removed), never Pending.
  const fleetUnsupported = getUnsupportedTool(device, 'FLEET_MDM') !== undefined;
  const supportAware = (toolType: string, status: ToolConnectionDisplayStatus): ToolConnectionDisplayStatus =>
    fleetUnsupported && FLEET_BUNDLED_TOOL_TYPES.has(toolType) ? 'not-supported' : status;

  const connectionMap = new Map<string, ToolConnection>();
  toolConnections.forEach((tc: ToolConnection) => {
    connectionMap.set(tc.toolType, tc);
  });

  const combinedAgents: CombinedAgent[] = installedAgents.map((agent: InstalledAgent) => {
    const mappedToolType = agentTypeToToolType[agent.agentType];
    const connection = mappedToolType ? connectionMap.get(mappedToolType) : null;

    const toolType = mappedToolType || agent.agentType.toUpperCase().replace(/-/g, '_');
    return {
      agentType: agent.agentType,
      version: agent.version,
      toolType,
      agentToolId: connection?.agentToolId,
      hasConnection: !!connection,
      isPlaceholder: false,
      status: supportAware(toolType, getAgentDisplayStatus(toolType, connection)),
      lastSeen: connection?.lastSeen,
      lastFetched: connection?.lastFetched,
      updatedAt: agent.updatedAt as string | undefined,
    };
  });

  toolConnections.forEach((tc: ToolConnection) => {
    const hasInstalledAgent = installedAgents.some(
      (agent: InstalledAgent) => agentTypeToToolType[agent.agentType] === tc.toolType,
    );

    if (!hasInstalledAgent) {
      combinedAgents.push({
        agentType: tc.toolType.toLowerCase().replace(/_/g, '-'),
        version: undefined,
        toolType: tc.toolType,
        agentToolId: tc.agentToolId,
        hasConnection: true,
        isPlaceholder: false,
        status: supportAware(tc.toolType, getAgentDisplayStatus(tc.toolType, tc)),
        lastSeen: tc.lastSeen,
        lastFetched: tc.lastFetched,
        // lastSyncAt is dead on the backend (never written on normal syncs) — the
        // "Updated" line falls back to lastFetched via showStatusBlock instead.
        updatedAt: undefined,
      });
    }
  });

  // An expected agent that has not reported yet keeps its slot as a pending card,
  // rather than being absent until its first installed-agent / tool-connection row lands.
  getExpectedAgentTypes(device, isSaasTenantMode()).forEach(agentType => {
    const toolType = agentTypeToToolType[agentType];
    if (combinedAgents.some(agent => agent.toolType === toolType)) return;

    combinedAgents.push({
      agentType,
      version: undefined,
      toolType,
      agentToolId: undefined,
      hasConnection: false,
      isPlaceholder: true,
      status: supportAware(toolType, 'pending'),
      lastSeen: undefined,
      lastFetched: undefined,
      updatedAt: undefined,
    });
  });

  // Sort agents alphabetically by agentType for a stable, predictable order across reloads.
  // Tie-break on the upstream agentToolId so equal types never reorder by API response order.
  combinedAgents.sort(
    (a, b) => a.agentType.localeCompare(b.agentType) || (a.agentToolId ?? '').localeCompare(b.agentToolId ?? ''),
  );
  return combinedAgents;
}

/**
 * An agent's status as its tag: the tool connection's own display status (online / offline / pending, or
 * not-supported when the device's OS is below the agent's minimum), not the device's lifecycle, so it has its own
 * mapper rather than the device's.
 */
export function getAgentStatusTag(status: string | null | undefined): {
  label: string;
  variant: 'success' | 'error' | 'warning' | 'grey';
} {
  const value = (status ?? 'offline').toLowerCase();
  if (value === 'online') return { label: 'ONLINE', variant: 'success' };
  if (value === 'offline') return { label: 'OFFLINE', variant: 'error' };
  if (value === 'pending') return { label: 'PENDING', variant: 'warning' };
  if (value === 'not-supported') return { label: 'NOT SUPPORTED', variant: 'error' };
  return { label: value.toUpperCase(), variant: 'grey' };
}

/** The rows and footer one agent's card shows. */
function agentCardData(agent: CombinedAgent): InfoCardData {
  const toolType = normalizeToolTypeWithFallback(agent.toolType);
  const statusConfig = getAgentStatusTag(agent.status);
  // A placeholder shows its pending status whatever the agent: openframe-chat
  // has no live status once installed, but it is still installing here.
  // An agent its OS does not support says so whatever its type: osquery has no live status, but is not running here.
  const showStatusBlock =
    agent.isPlaceholder ||
    agent.status === 'not-supported' ||
    (AGENT_TYPES_WITH_STATUS.has(agent.toolType) &&
      (agent.status != null || agent.lastSeen != null || agent.lastFetched != null));

  // InfoCard's own row type says `value: string | string[]`, but the card
  // renders whatever it is handed and these rows carry ReactNodes (Tag,
  // ToolBadge). Widened locally rather than cast at the call site so each
  // push below is still checked against a real shape.
  const items: Array<{ label?: string; value: ReactNode; copyable?: boolean; icon?: ReactNode }> = [
    { label: AGENT_ROW_LABELS.agent, value: <ToolBadge toolType={toolType} /> },
  ];

  if (showStatusBlock && agent.status != null) {
    items.push({
      label: AGENT_ROW_LABELS.status,
      value: <Tag label={statusConfig.label} variant={statusConfig.variant} />,
    });
  }

  const lastSeen = showStatusBlock ? formatTimestamp(agent.lastSeen) : undefined;
  if (lastSeen) items.push({ label: AGENT_ROW_LABELS.lastSeen, value: lastSeen });

  if (agent.agentToolId) items.push({ label: AGENT_ROW_LABELS.id, value: agent.agentToolId, copyable: true });
  if (agent.version) items.push({ label: AGENT_ROW_LABELS.version, value: agent.version });

  const updated = formatRelative(agent.updatedAt) ?? (showStatusBlock ? formatRelative(agent.lastFetched) : undefined);
  if (updated) items.push({ label: AGENT_ROW_LABELS.updated, value: updated });

  // The cast is what the loose `any[]` used to be, now confined to the
  // one boundary that needs it: InfoCard's props model `value` as a
  // string, and these rows are Tags and badges.
  return { items: items as InfoCardData['items'], footer: getAgentFooter(agent.toolType) };
}

/** The tab's section headings (Figma: AGENTS, then PACKAGE MANAGERS; the caption face sets the case). */
const SECTION_TITLES = {
  agents: 'Agents',
  packageManagers: 'Package Managers',
} as const;

/** Each package manager's grey mark, as the agents' marks are drawn. */
const PACKAGE_MANAGER_ICON: Record<PackageManagerType, ComponentType<{ size?: number }>> = {
  [PackageManagerType.CHOCO]: ChocolateyLogoGreyIcon,
  [PackageManagerType.WINGET]: WingetLogoGreyIcon,
  [PackageManagerType.BREW]: HomebrewLogoGreyIcon,
};

/**
 * The rows of a package manager's card: Agent, then Version and Updated (when its version arrived on the device, not
 * when it last reported), or Status PENDING while OpenFrame installs it. No footer: the managers are not Flamingo builds.
 */
export function packageManagerCardData(card: PackageManagerCard): InfoCardData {
  const Icon = PACKAGE_MANAGER_ICON[card.type];
  const items: Array<{ label?: string; value: ReactNode }> = [
    { label: AGENT_ROW_LABELS.agent, value: <ToolBadge label={card.label} icon={Icon ? <Icon size={16} /> : null} /> },
  ];
  if (card.pending) {
    const pending = getAgentStatusTag('pending');
    items.push({ label: AGENT_ROW_LABELS.status, value: <Tag label={pending.label} variant={pending.variant} /> });
  }
  if (card.version) items.push({ label: AGENT_ROW_LABELS.version, value: card.version });
  const changedAt = card.versionChangedAt ? parseInstant(card.versionChangedAt) : null;
  if (changedAt) items.push({ label: AGENT_ROW_LABELS.updated, value: formatRelativeTime(changedAt) });
  // InfoCard models `value` as a string; these rows carry a badge and a tag (see agentCardData).
  return { items: items as InfoCardData['items'] };
}

export function AgentsTab({ device }: AgentsTabProps) {
  const loading = useLoadingScope();
  // The tab's own read, outside the device poll. Not read yet, refused by an older backend, or failed before its first
  // answer: no section. A failed refetch keeps the last answer.
  const { data: packageManagers } = useDevicePackageManagers(device?.machineId);

  if (loading) {
    // The data is not touched: each slot is a card with no rows, drawn in its agent's loading shape. The package
    // managers have no skeleton: which ones a device has is unknown until its data arrives, and on a device with none
    // the section would flash and go.
    return (
      <CardSection title={SECTION_TITLES.agents}>
        <LoadingItems count={AGENT_CARD_SKELETONS.length}>
          {index => (
            <InfoCard data={EMPTY_CARD} skeleton={AGENT_CARD_SKELETONS[index]} className="h-full" data-loading-item />
          )}
        </LoadingItems>
      </CardSection>
    );
  }

  const agents = combineAgents(device);
  const managers = packageManagerCards(packageManagers);
  if (agents.length === 0 && managers.length === 0) {
    return (
      <TabEmptyState
        icon={<TerminalBrowserIcon />}
        title="No agents found"
        description="Agents installed on this device will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {agents.length > 0 && (
        <CardSection title={SECTION_TITLES.agents}>
          {agents.map((agent, idx) => (
            <InfoCard
              key={`${agent.agentType}-${agent.agentToolId || idx}`}
              data={agentCardData(agent)}
              className="h-full"
              data-loading-item
            />
          ))}
        </CardSection>
      )}
      {managers.length > 0 && (
        <CardSection title={SECTION_TITLES.packageManagers}>
          {managers.map(card => (
            <InfoCard key={card.type} data={packageManagerCardData(card)} className="h-full" data-loading-item />
          ))}
        </CardSection>
      )}
    </div>
  );
}

/** A section heading and the grid its cards sit in, loading and loaded alike. */
function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="uppercase text-ods-text-secondary text-h5">{title}</h3>
      <div className="grid grid-cols-1 items-stretch gap-[var(--spacing-system-l)] content-md:grid-cols-2 content-lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
