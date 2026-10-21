'use client';

import {
  NamedIcon,
  TextLineSkeleton,
  UnifiedSkeleton,
  useAgentIdentityIcon,
} from '@flamingo-stack/openframe-frontend-core/components';
import { EntityImage, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { getFullImageUrl } from '@/lib/image-url';
import type { AgentAiConfig, ClientView } from '../types/ai-settings';
import { ANSWER_STYLE_LABEL, LLM_PROVIDER_ICON, LLM_PROVIDER_LABEL } from '../utils/ai-settings-display';

interface AiSettingsCustomerCardProps {
  /** Unread while loading (with `view`). */
  aiConfig?: AgentAiConfig;
  view?: ClientView;
  /** Display name for `aiConfig.providerModel` (which stores the backend model name). */
  providerModelLabel?: string;
}

const CELL = 'flex items-center gap-2 min-h-14 content-md:min-h-20 px-3 content-md:px-4 py-3 content-md:py-4';

const GRID_CLASS = 'grid grid-cols-2 rounded-md border border-ods-border bg-ods-card content-lg:grid-cols-4';

/**
 * Five cells: the last one takes the whole bottom row of the two-column grid and sits alone on the second row of
 * the four-column one, so in both layouts every cell but the last has a row below it.
 */
function cellClass(idx: number, count: number) {
  return cn(
    CELL,
    idx < count - 1 && 'border-b border-ods-border',
    idx === count - 1 && 'col-span-2 content-lg:col-span-1',
  );
}

/** In a loading scope (or with no configuration yet) every cell draws itself: its label real, its value a bar. */
export function AiSettingsCustomerCard({ aiConfig, view, providerModelLabel }: AiSettingsCustomerCardProps) {
  const faeAvatar = useAgentIdentityIcon('fae')?.url ?? undefined;
  const loading = useLoadingScope() || aiConfig == null || view == null;
  const answerStyleLabel = aiConfig?.answerStyle ? ANSWER_STYLE_LABEL[aiConfig.answerStyle] : EMPTY_VALUE;

  const cells: ReactNode[] = [
    <>
      <EntityImage
        // With no custom image configured, Fae's own picture: the one her server
        // identity holds, the same the previews (AiSettingsPreviews) fall back to.
        src={
          loading
            ? undefined
            : getFullImageUrl(view?.assistantAvatar?.imageUrl, view?.assistantAvatar?.hash) || faeAvatar
        }
        alt={view?.assistantName ?? ''}
        // EntityImage defaults to size-[52px] content-md:size-[60px]; override both
        // breakpoints so the avatar stays 40×40 (the md: default would otherwise win).
        className="size-10 rounded-full content-md:size-10"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {loading ? (
          <TextLineSkeleton type="h4" className="w-24 max-w-full" />
        ) : (
          <TruncateText>{view?.assistantName}</TruncateText>
        )}
        <p className="truncate text-ods-text-secondary text-h6">Assistant Name</p>
      </div>
    </>,
    <InfoCell
      key="llm-provider"
      loading={loading}
      skeletonWidth="w-24"
      value={aiConfig && LLM_PROVIDER_LABEL[aiConfig.llmProvider]}
      label="LLM Provider"
      icon={
        aiConfig && !loading ? (
          <NamedIcon icon={LLM_PROVIDER_ICON[aiConfig.llmProvider]} className="h-6 w-6 text-ods-text-secondary" />
        ) : (
          <UnifiedSkeleton className="size-6 rounded" />
        )
      }
    />,
    <InfoCell
      key="provider-model"
      loading={loading}
      skeletonWidth="w-24"
      value={providerModelLabel || aiConfig?.providerModel || EMPTY_VALUE}
      label="Provider Model"
    />,
    <InfoCell
      key="answer-style"
      loading={loading}
      skeletonWidth="w-24"
      value={answerStyleLabel}
      label="Answer Style"
    />,
    <InfoCell
      key="accent-color"
      loading={loading}
      skeletonWidth="w-24"
      value={view?.accentColor?.toUpperCase()}
      label="Accent Color"
    />,
  ];

  return (
    <div className={GRID_CLASS}>
      {cells.map((cell, idx) => (
        <div key={idx} className={cellClass(idx, cells.length)}>
          {cell}
        </div>
      ))}
    </div>
  );
}
