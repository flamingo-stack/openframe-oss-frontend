'use client';

import { NamedIcon, useAgentIdentityIcon } from '@flamingo-stack/openframe-frontend-core/components';
import { EntityImage, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { getFullImageUrl } from '@/lib/image-url';
import type { AgentAiConfig, ClientView } from '../types/ai-settings';
import { ANSWER_STYLE_LABEL, LLM_PROVIDER_ICON, LLM_PROVIDER_LABEL } from '../utils/ai-settings-display';

interface AiSettingsCustomerCardProps {
  aiConfig: AgentAiConfig;
  view: ClientView;
  /** Display name for `aiConfig.providerModel` (which stores the backend model name). */
  providerModelLabel?: string;
}

const CELL = 'flex items-center gap-2 min-h-14 content-md:min-h-20 px-3 content-md:px-4 py-3 content-md:py-4';

export function AiSettingsCustomerCard({ aiConfig, view, providerModelLabel }: AiSettingsCustomerCardProps) {
  const faeAvatar = useAgentIdentityIcon('fae')?.url ?? undefined;
  const answerStyleLabel = aiConfig.answerStyle ? ANSWER_STYLE_LABEL[aiConfig.answerStyle] : EMPTY_VALUE;

  const cells: ReactNode[] = [
    <>
      <EntityImage
        // With no custom image configured, Fae's own picture: the one her server
        // identity holds, the same the previews (AiSettingsPreviews) fall back to.
        src={getFullImageUrl(view.assistantAvatar?.imageUrl, view.assistantAvatar?.hash) || faeAvatar}
        alt={view.assistantName}
        // EntityImage defaults to size-[52px] content-md:size-[60px]; override both
        // breakpoints so the avatar stays 40×40 (the md: default would otherwise win).
        className="size-10 rounded-full content-md:size-10"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <TruncateText>{view.assistantName}</TruncateText>
        <p className="truncate text-ods-text-secondary text-h6">Assistant Name</p>
      </div>
    </>,
    <InfoCell
      key="llm-provider"
      value={LLM_PROVIDER_LABEL[aiConfig.llmProvider]}
      label="LLM Provider"
      icon={<NamedIcon icon={LLM_PROVIDER_ICON[aiConfig.llmProvider]} className="h-6 w-6 text-ods-text-secondary" />}
    />,
    <InfoCell
      key="provider-model"
      value={providerModelLabel || aiConfig.providerModel || EMPTY_VALUE}
      label="Provider Model"
    />,
    <InfoCell key="answer-style" value={answerStyleLabel} label="Answer Style" />,
    <InfoCell key="accent-color" value={view.accentColor?.toUpperCase()} label="Accent Color" />,
  ];

  return (
    <div className="grid grid-cols-2 rounded-md border border-ods-border bg-ods-card content-lg:grid-cols-4">
      {cells.map((cell, idx) => (
        // Five cells: the last one takes the whole bottom row of the two-column
        // grid and sits alone on the second row of the four-column one, so in
        // both layouts every cell but the last has a row below it.
        <div
          key={idx}
          className={cn(
            CELL,
            idx < cells.length - 1 && 'border-b border-ods-border',
            idx === cells.length - 1 && 'col-span-2 content-lg:col-span-1',
          )}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}
