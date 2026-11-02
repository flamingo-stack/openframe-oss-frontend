'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { AgentAiConfig } from '../types/ai-settings';
import { AI_CONFIG_CELL_CLASS, aiConfigCells } from './ai-config-cells';

interface AiSettingsAdminCardProps {
  /** Unread while loading. */
  aiConfig?: AgentAiConfig;
  /** Display name for `aiConfig.providerModel` (which stores the backend model name). */
  providerModelLabel?: string;
}

const GRID_CLASS = 'grid grid-cols-1 rounded-md border border-ods-border bg-ods-card content-sm:grid-cols-3';

/**
 * Read-only summary card for the Mingo (ADMIN) tab: LLM provider, provider model and answer style. The CLIENT
 * counterpart (AiSettingsCustomerCard) adds the appearance fields; this one carries only the AI-logic columns per the
 * design. In a loading scope (or with no configuration yet) every cell draws itself: its label real, its value a bar.
 */
export function AiSettingsAdminCard({ aiConfig, providerModelLabel }: AiSettingsAdminCardProps) {
  const loading = useLoadingScope() || aiConfig == null;

  return (
    <div className={GRID_CLASS}>
      {aiConfigCells({ aiConfig, providerModelLabel, loading, providerLabel: 'Mingo LLM Provider' }).map(cell => (
        <div key={cell.key} className={AI_CONFIG_CELL_CLASS}>
          {cell}
        </div>
      ))}
    </div>
  );
}
