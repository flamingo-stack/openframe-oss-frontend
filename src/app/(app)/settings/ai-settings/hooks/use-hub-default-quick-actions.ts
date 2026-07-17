'use client';

import { useEmptyStateConfig } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import type { AiQuickAction } from '../types/ai-settings';

/**
 * OpenFrame default quick actions, served by the Product Hub through the
 * gateway's `/chat/content/**` proxy (agent public config, source-keyed on
 * `agent-<slug>`). Shown/seeded while `quickActionsIsDefault` is on — the
 * tenant BE stores only the org's customized list, never the hub defaults.
 * `useEmptyStateConfig` caches per URL for the whole session (one request).
 */
const hubAgentConfigUrl = (slug: string) => `/chat/content/api/ai-agents/${encodeURIComponent(slug)}`;

export function useHubDefaultQuickActions(agentSlug: string, options: { enabled?: boolean } = {}) {
  const { config, loading, loaded } = useEmptyStateConfig(hubAgentConfigUrl(agentSlug), options);

  const actions = useMemo<AiQuickAction[]>(
    () => config.quickActions.map(action => ({ id: action.id, name: action.label, instructions: action.prompt })),
    [config.quickActions],
  );

  return { actions, loading, loaded };
}
