'use client';

import { NamedIcon, TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
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
const CELL_LABELS = ['Mingo LLM Provider', 'Provider Model', 'Answer Style'] as const;

/** The card while the configuration is on its way: every cell's label is fixed copy, its value a bar. */
export function AiSettingsAdminCardSkeleton() {
  return (
    <div className={GRID_CLASS}>
      {CELL_LABELS.map((label, idx) => (
        <div key={label} className={CELL}>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {/* The provider's value carries its icon beside it, as `InfoCell` draws it. */}
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
              {idx === 0 && <UnifiedSkeleton className="size-6 shrink-0 rounded" />}
              <TextLineSkeleton type="h4" className="w-24 max-w-full" />
            </div>
            <p className="truncate text-ods-text-secondary text-h6">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AiSettingsAdminCard({ aiConfig, providerModelLabel }: AiSettingsAdminCardProps) {
  if (useLoadingScope() || aiConfig == null) return <AiSettingsAdminCardSkeleton />;
  const answerStyleLabel = aiConfig.answerStyle ? ANSWER_STYLE_LABEL[aiConfig.answerStyle] : EMPTY_VALUE;

  return (
    <div className={GRID_CLASS}>
      <div className={CELL}>
        <InfoCell
          value={LLM_PROVIDER_LABEL[aiConfig.llmProvider]}
          label="Mingo LLM Provider"
          icon={
            <NamedIcon icon={LLM_PROVIDER_ICON[aiConfig.llmProvider]} className="h-6 w-6 text-ods-text-secondary" />
          }
        />
      </div>
      <div className={CELL}>
        <InfoCell value={providerModelLabel || aiConfig.providerModel || EMPTY_VALUE} label="Provider Model" />
      </div>
      <div className={CELL}>
        <InfoCell value={answerStyleLabel} label="Answer Style" />
      </div>
    </div>
  );
}
