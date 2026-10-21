'use client';

import { NamedIcon } from '@flamingo-stack/openframe-frontend-core/components';
import { InfoCell } from '@/app/components/shared/info-cell';
import { EMPTY_VALUE } from '@/lib/empty-value';
import type { AgentAiConfig } from '../types/ai-settings';
import { ANSWER_STYLE_LABEL, LLM_PROVIDER_ICON, LLM_PROVIDER_LABEL } from '../utils/ai-settings-display';

/** One summary cell's frame: 56px tall with 12px padding on mobile, 80px with 16px from md. */
export const AI_CONFIG_CELL_CLASS =
  'flex items-center gap-2 min-h-14 content-md:min-h-20 px-3 content-md:px-4 py-3 content-md:py-4';

/** The value bar's width in every summary cell. */
export const AI_CONFIG_VALUE_SKELETON_WIDTH = 'w-24';

interface AiConfigCellsOptions {
  /** Unread while loading. */
  aiConfig?: AgentAiConfig;
  /** Display name for `aiConfig.providerModel` (which stores the backend model name). */
  providerModelLabel?: string;
  loading: boolean;
  /** The provider cell's label ("LLM Provider", "Mingo LLM Provider"). */
  providerLabel: string;
}

/**
 * The AI-logic cells both summary cards show (LLM provider with its icon, provider model, answer style), in that
 * order. Each is an `InfoCell`: while loading its label is real and its value a bar, the provider icon an icon box.
 */
export function aiConfigCells({ aiConfig, providerModelLabel, loading, providerLabel }: AiConfigCellsOptions) {
  return [
    <InfoCell
      key="llm-provider"
      loading={loading}
      skeletonWidth={AI_CONFIG_VALUE_SKELETON_WIDTH}
      value={aiConfig && LLM_PROVIDER_LABEL[aiConfig.llmProvider]}
      label={providerLabel}
      icon={
        aiConfig && (
          <NamedIcon icon={LLM_PROVIDER_ICON[aiConfig.llmProvider]} className="h-6 w-6 text-ods-text-secondary" />
        )
      }
      iconSkeleton={{ size: 'md' }}
    />,
    <InfoCell
      key="provider-model"
      loading={loading}
      skeletonWidth={AI_CONFIG_VALUE_SKELETON_WIDTH}
      value={providerModelLabel || aiConfig?.providerModel || EMPTY_VALUE}
      label="Provider Model"
    />,
    <InfoCell
      key="answer-style"
      loading={loading}
      skeletonWidth={AI_CONFIG_VALUE_SKELETON_WIDTH}
      value={aiConfig?.answerStyle ? ANSWER_STYLE_LABEL[aiConfig.answerStyle] : EMPTY_VALUE}
      label="Answer Style"
    />,
  ];
}
