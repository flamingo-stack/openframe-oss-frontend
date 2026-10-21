'use client';

import { NamedIcon, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InfoCell } from '@/app/components/shared/info-cell';
import { EMPTY_VALUE } from '@/lib/empty-value';
import type { AgentAiConfig } from '../types/ai-settings';
import { ANSWER_STYLE_LABEL, LLM_PROVIDER_ICON, LLM_PROVIDER_LABEL } from '../utils/ai-settings-display';

interface AiSettingsAdminCardProps {
  /** Unread while loading. */
  aiConfig?: AgentAiConfig;
  /** Display name for `aiConfig.providerModel` (which stores the backend model name). */
  providerModelLabel?: string;
}

const CELL = 'flex items-center gap-2 min-h-14 content-md:min-h-20 px-3 content-md:px-4 py-3 content-md:py-4';

/**
 * Read-only summary card for the Mingo (ADMIN) tab: LLM provider, provider model
 * and answer style. The CLIENT counterpart (AiSettingsCustomerCard) adds the
 * appearance fields; this one carries only the AI-logic columns per the design.
 */
const GRID_CLASS = 'grid grid-cols-1 rounded-md border border-ods-border bg-ods-card content-sm:grid-cols-3';

/** In a loading scope (or with no configuration yet) every cell draws itself: its label real, its value a bar. */
export function AiSettingsAdminCard({ aiConfig, providerModelLabel }: AiSettingsAdminCardProps) {
  const loading = useLoadingScope() || aiConfig == null;
  const answerStyleLabel = aiConfig?.answerStyle ? ANSWER_STYLE_LABEL[aiConfig.answerStyle] : EMPTY_VALUE;

  return (
    <div className={GRID_CLASS}>
      <div className={CELL}>
        <InfoCell
          loading={loading}
          skeletonWidth="w-24"
          value={aiConfig && LLM_PROVIDER_LABEL[aiConfig.llmProvider]}
          label="Mingo LLM Provider"
          icon={
            aiConfig && !loading ? (
              <NamedIcon icon={LLM_PROVIDER_ICON[aiConfig.llmProvider]} className="h-6 w-6 text-ods-text-secondary" />
            ) : (
              <UnifiedSkeleton className="size-6 rounded" />
            )
          }
        />
      </div>
      <div className={CELL}>
        <InfoCell
          loading={loading}
          skeletonWidth="w-24"
          value={providerModelLabel || aiConfig?.providerModel || EMPTY_VALUE}
          label="Provider Model"
        />
      </div>
      <div className={CELL}>
        <InfoCell loading={loading} skeletonWidth="w-24" value={answerStyleLabel} label="Answer Style" />
      </div>
    </div>
  );
}
