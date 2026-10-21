'use client';

import { InfoCard, type InfoCardData, Tag } from '@flamingo-stack/openframe-frontend-core';
import { ToolBadge } from '@flamingo-stack/openframe-frontend-core/components';
import { getDeviceStatusConfig } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TerminalBrowserIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingItems, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime, normalizeToolTypeWithFallback } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { EMPTY_CARD } from '@/app/components/shared/info-card-loading';
import { isSaasTenantMode } from '@/lib/app-mode';
import { formatDateTime } from '@/lib/format-date';
import type { Device, InstalledAgent, ToolConnection } from '../../types/device.types';
import { getAgentFooter } from '../../utils/agent-footer';
import {
  getExpectedAgentTypes,
  getToolConnectionDisplayStatus,
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

/** One card per installed agent, tool connection and expected agent not reported yet, in a stable order. */
function combineAgents(device: Device): CombinedAgent[] {
  const toolConnections = Array.isArray(device?.toolConnections) ? device.toolConnections : [];
  const installedAgents = Array.isArray(device?.installedAgents) ? device.installedAgents : [];

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
      status: getAgentDisplayStatus(toolType, connection),
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
        status: getAgentDisplayStatus(tc.toolType, tc),
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
      status: 'pending',
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

/** The rows and footer one agent's card shows. */
function agentCardData(agent: CombinedAgent): InfoCardData {
  const toolType = normalizeToolTypeWithFallback(agent.toolType);
  const statusConfig = getDeviceStatusConfig(agent.status ?? 'offline');
  // A placeholder shows its pending status whatever the agent: openframe-chat
  // has no live status once installed, but it is still installing here.
  const showStatusBlock =
    agent.isPlaceholder ||
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

export function AgentsTab({ device }: AgentsTabProps) {
  const loading = useLoadingScope();

  if (loading) {
    // The data is not touched: each slot is a card with no rows, drawn in its agent's loading shape.
    return (
      <AgentCards>
        <LoadingItems count={AGENT_CARD_SKELETONS.length}>
          {index => (
            <InfoCard data={EMPTY_CARD} skeleton={AGENT_CARD_SKELETONS[index]} className="h-full" data-loading-item />
          )}
        </LoadingItems>
      </AgentCards>
    );
  }

  const agents = combineAgents(device);
  if (agents.length === 0) {
    return (
      <TabEmptyState
        icon={<TerminalBrowserIcon />}
        title="No agents found"
        description="Agents installed on this device will appear here."
      />
    );
  }

  return (
    <AgentCards>
      {agents.map((agent, idx) => (
        <InfoCard
          key={`${agent.agentType}-${agent.agentToolId || idx}`}
          data={agentCardData(agent)}
          className="h-full"
          data-loading-item
        />
      ))}
    </AgentCards>
  );
}

/** The section heading and the grid the cards sit in, loading and loaded alike. */
function AgentCards({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="uppercase text-ods-text-secondary text-h5">Agent Versions</h3>
      <div className="grid grid-cols-1 items-stretch gap-[var(--spacing-system-l)] content-md:grid-cols-2 content-lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
