'use client';

import { InfoCard, Tag } from '@flamingo-stack/openframe-frontend-core';
import { ToolBadge } from '@flamingo-stack/openframe-frontend-core/components';
import { TerminalBrowserIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { formatRelativeTime, normalizeToolTypeWithFallback } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { formatDateTime } from '@/lib/format-date';
import type { Device, InstalledAgent, ToolConnection } from '../../types/device.types';
import { getAgentFooter } from '../../utils/agent-footer';
import { getDeviceStatusConfig } from '../../utils/device-status';
import { getToolConnectionDisplayStatus, type ToolConnectionDisplayStatus } from '../../utils/tool-connection-status';
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

const AGENT_TYPES_WITH_STATUS = new Set(['FLEET_MDM', 'MESHCENTRAL']);

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

export function AgentsTab({ device }: AgentsTabProps) {
  const toolConnections = Array.isArray(device?.toolConnections) ? device.toolConnections : [];
  const installedAgents = Array.isArray(device?.installedAgents) ? device.installedAgents : [];

  const connectionMap = new Map<string, ToolConnection>();
  toolConnections.forEach((tc: ToolConnection) => {
    connectionMap.set(tc.toolType, tc);
  });

  const combinedAgents = installedAgents.map((agent: InstalledAgent) => {
    const mappedToolType = agentTypeToToolType[agent.agentType];
    const connection = mappedToolType ? connectionMap.get(mappedToolType) : null;

    const toolType = mappedToolType || agent.agentType.toUpperCase().replace(/-/g, '_');
    return {
      agentType: agent.agentType,
      version: agent.version,
      toolType,
      agentToolId: connection?.agentToolId,
      hasConnection: !!connection,
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
        status: getAgentDisplayStatus(tc.toolType, tc),
        lastSeen: tc.lastSeen,
        lastFetched: tc.lastFetched,
        // lastSyncAt is dead on the backend (never written on normal syncs) — the
        // "Updated" line falls back to lastFetched via showStatusBlock instead.
        updatedAt: undefined,
      });
    }
  });

  // Sort agents alphabetically by agentType for a stable, predictable order across reloads.
  // Tie-break on the upstream agentToolId so equal types never reorder by API response order.
  combinedAgents.sort(
    (a, b) => a.agentType.localeCompare(b.agentType) || (a.agentToolId ?? '').localeCompare(b.agentToolId ?? ''),
  );

  const hasAgents = combinedAgents.length > 0;

  if (!hasAgents) {
    return (
      <TabEmptyState
        icon={<TerminalBrowserIcon />}
        title="No agents found"
        description="Agents installed on this device will appear here."
      />
    );
  }

  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="uppercase text-ods-text-secondary text-h5">Agent Versions</h3>
      <div className="grid grid-cols-1 items-stretch gap-[var(--spacing-system-l)] md:grid-cols-2 lg:grid-cols-3">
        {combinedAgents.map((agent, idx) => {
          const toolType = normalizeToolTypeWithFallback(agent.toolType);
          const statusConfig = getDeviceStatusConfig(agent.status ?? 'offline');
          const showStatusBlock =
            AGENT_TYPES_WITH_STATUS.has(agent.toolType) &&
            (agent.status != null || agent.lastSeen != null || agent.lastFetched != null);

          // `value` carries ReactNodes (Tag, ToolBadge); InfoCard's typings only model strings, so
          // the items array stays loosely typed (matching the prior implementation) and renders inline.
          // InfoCard's own row type says `value: string | string[]`, but the card
          // renders whatever it is handed and these rows carry ReactNodes (Tag,
          // ToolBadge). Widened locally rather than cast at the call site so each
          // push below is still checked against a real shape.
          const items: Array<{ label?: string; value: ReactNode; copyable?: boolean; icon?: ReactNode }> = [
            { label: 'Agent', value: <ToolBadge toolType={toolType} /> },
          ];

          if (showStatusBlock && agent.status != null) {
            items.push({ label: 'Status', value: <Tag label={statusConfig.label} variant={statusConfig.variant} /> });
          }

          const lastSeen = showStatusBlock ? formatTimestamp(agent.lastSeen) : undefined;
          if (lastSeen) items.push({ label: 'Last Seen', value: lastSeen });

          if (agent.agentToolId) items.push({ label: 'ID', value: agent.agentToolId, copyable: true });
          if (agent.version) items.push({ label: 'Version', value: agent.version });

          const updated =
            formatRelative(agent.updatedAt) ?? (showStatusBlock ? formatRelative(agent.lastFetched) : undefined);
          if (updated) items.push({ label: 'Updated', value: updated });

          return (
            <InfoCard
              key={`${agent.agentType}-${agent.agentToolId || idx}`}
              // The cast is what the loose `any[]` used to be, now confined to the
              // one boundary that needs it: InfoCard's props model `value` as a
              // string, and these rows are Tags and badges.
              data={{ items: items as { label?: string; value: string }[], footer: getAgentFooter(agent.toolType) }}
              className="h-full"
            />
          );
        })}
      </div>
    </section>
  );
}
