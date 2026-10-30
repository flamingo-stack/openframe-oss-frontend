'use client';

import { useAdminAiConfig } from '../../settings/ai-settings/hooks/use-agent-ai-config';
import { useHubDefaultQuickActions } from '../../settings/ai-settings/hooks/use-hub-default-quick-actions';
import type { AiQuickAction } from '../../settings/ai-settings/types/ai-settings';

/**
 * Mingo quick actions for the chat's empty-state chip row.
 *
 * Source follows the ADMIN config's `quickActionsIsDefault`: on → the OpenFrame
 * defaults fetched from the Product Hub (`agent-mingo` public config via the
 * gateway's `/chat/content/**` proxy); off → the org's customized actions from
 * the tenant BE — the same record the AI Settings "Mingo AI Chat" tab edits.
 * `loading` while the config, or the defaults it falls back to, are still read.
 */
export function useMingoQuickActions(): { actions: AiQuickAction[]; loading: boolean } {
  const { config, isLoading } = useAdminAiConfig();
  const isDefault = config?.quickActionsIsDefault ?? true;
  const hubDefaults = useHubDefaultQuickActions('mingo', { enabled: isDefault });

  return isDefault
    ? { actions: hubDefaults.actions, loading: isLoading || hubDefaults.loading }
    : { actions: config?.quickActions ?? [], loading: false };
}
