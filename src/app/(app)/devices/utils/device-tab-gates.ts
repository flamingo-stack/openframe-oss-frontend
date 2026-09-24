import type { FeatureFlagGate } from '@/lib/feature-flags';
import type { DeviceDetailTab } from '@/lib/routes';

export const DEFAULT_DEVICE_TAB = 'overview' satisfies DeviceDetailTab;
export const AGENT_LOGS_TAB_ID = 'agent-logs' satisfies DeviceDetailTab;

/**
 * Agent Logs is listed when its flag is on — and, while the flag loads, for a deep
 * link that asked for it, so the page and its skeleton show the same tab bar.
 */
export function listsAgentLogsTab(gate: FeatureFlagGate, requestedTab: string): boolean {
  return gate === 'on' || (gate === 'loading' && requestedTab === AGENT_LOGS_TAB_ID);
}

/**
 * The tab `?tab=` resolves to among the listed ones; anything else is Overview. A deep
 * link to Agent Logs waits while its flag loads instead of painting Overview first.
 */
export function resolveDeviceTab(
  requestedTab: string,
  listedTabIds: readonly string[],
  agentLogsGate: FeatureFlagGate,
): { tab: string; awaitingFlag: boolean } {
  return {
    tab: listedTabIds.includes(requestedTab) ? requestedTab : DEFAULT_DEVICE_TAB,
    awaitingFlag: requestedTab === AGENT_LOGS_TAB_ID && agentLogsGate === 'loading',
  };
}
