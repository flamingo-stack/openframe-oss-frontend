'use client';

import { useEmptyStateConfig } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import { CONTENT_BASE } from '@/app/(app)/help-center/endpoints';
import type { AiQuickAction } from '../types/ai-settings';

/**
 * OpenFrame default quick actions, served by the Product Hub through the
 * gateway's `/content/**` hub proxy (agent public config, source-keyed on
 * `agent-<slug>` — same route the Guide chat and onboarding MingoStep use;
 * in local dev Next only rewrites `/content/*`, not `/chat/content/*`).
 * Shown/seeded while `quickActionsIsDefault` is on — the tenant BE stores
 * only the org's customized list, never the hub defaults.
 * `useEmptyStateConfig` caches per URL for the whole session (one request).
 *
 * Built on `CONTENT_BASE`, not a hand-written `/content/…` literal: in the
 * native shell that relative path resolves against `capacitor://localhost`,
 * and the lib's `embedAuthedFetch` refuses non-http(s) URLs — the fetch threw,
 * `useEmptyStateConfig` swallowed it into its neutral fallback, and the
 * defaults list rendered empty on mobile. `CONTENT_BASE` absolutizes to the
 * tenant gateway there (and stays relative on the web).
 */
const hubAgentConfigUrl = (slug: string) => `${CONTENT_BASE}/api/ai-agents/${encodeURIComponent(slug)}`;

export function useHubDefaultQuickActions(agentSlug: string, options: { enabled?: boolean } = {}) {
  const { config, loading, loaded } = useEmptyStateConfig(hubAgentConfigUrl(agentSlug), options);

  const actions = useMemo<AiQuickAction[]>(
    () =>
      config.quickActions.map(action => ({
        id: action.id,
        name: action.label,
        instructions: action.prompt,
        // Preserve the hub glyph so the CHAT chip can render it. The settings
        // editor ignores these fields (it can't persist icons yet).
        iconName: action.iconName,
        iconUrl: action.iconUrl,
        iconProps: action.iconProps,
      })),
    [config.quickActions],
  );

  return { actions, loading, loaded };
}
