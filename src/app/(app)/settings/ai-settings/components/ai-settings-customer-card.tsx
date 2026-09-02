'use client';

import { FAE_AVATAR_DATA_URI } from '@flamingo-stack/openframe-frontend-core/assets';
import { EntityImage, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';
import type { AgentAiConfig, ClientView } from '../types/ai-settings';
import {
  ANSWER_STYLE_LABEL,
  APPLICATION_THEME_LABEL,
  LLM_PROVIDER_ICON,
  LLM_PROVIDER_LABEL,
} from '../utils/ai-settings-display';

interface AiSettingsCustomerCardProps {
  aiConfig: AgentAiConfig;
  view: ClientView;
  /** Display name for `aiConfig.providerModel` (which stores the backend model name). */
  providerModelLabel?: string;
}

const CELL = 'flex items-center gap-2 min-h-14 md:min-h-20 px-3 md:px-4 py-3 md:py-4';

export function AiSettingsCustomerCard({ aiConfig, view, providerModelLabel }: AiSettingsCustomerCardProps) {
  const ProviderIcon = LLM_PROVIDER_ICON[aiConfig.llmProvider];
  const answerStyleLabel = aiConfig.answerStyle ? ANSWER_STYLE_LABEL[aiConfig.answerStyle] : '—';

  const cells: ReactNode[] = [
    <>
      <EntityImage
        // Fall back to the packaged default Fae avatar when no custom image is
        // configured — matches the previews (AiSettingsPreviews), which use the
        // same fallback; otherwise EntityImage would render bare initials here
        // while the previews show the default avatar.
        src={getFullImageUrl(view.assistantAvatar?.imageUrl, view.assistantAvatar?.hash) || FAE_AVATAR_DATA_URI}
        alt={view.assistantName}
        // EntityImage defaults to size-[52px] md:size-[60px]; override both
        // breakpoints so the avatar stays 40×40 (the md: default would otherwise win).
        className="size-10 rounded-full md:size-10"
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
      icon={<ProviderIcon className="h-6 w-6 text-ods-text-secondary" />}
    />,
    <InfoCell
      key="provider-model"
      value={providerModelLabel || aiConfig.providerModel || '—'}
      label="Provider Model"
    />,
    <InfoCell key="answer-style" value={answerStyleLabel} label="Answer Style" />,
    <InfoCell
      key="application-theme"
      value={APPLICATION_THEME_LABEL[view.applicationTheme]}
      label="Application Theme"
    />,
    <InfoCell key="accent-color" value={view.accentColor?.toUpperCase()} label="Accent Color" />,
  ];

  return (
    <div className="grid grid-cols-2 rounded-md border border-ods-border bg-ods-card lg:grid-cols-4">
      {cells.map((cell, idx) => (
        <div key={idx} className={cn(CELL, idx < cells.length - 2 && 'border-b border-ods-border')}>
          {cell}
        </div>
      ))}
    </div>
  );
}
