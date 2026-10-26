'use client';

import { useAgentIdentityIcon } from '@flamingo-stack/openframe-frontend-core/components';
import { EntityImage, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';
import type { AgentAiConfig, ClientView } from '../types/ai-settings';
import { AI_CONFIG_CELL_CLASS, AI_CONFIG_VALUE_SKELETON_WIDTH, aiConfigCells } from './ai-config-cells';

interface AiSettingsCustomerCardProps {
  /** Unread while loading (with `view`). */
  aiConfig?: AgentAiConfig;
  view?: ClientView;
  /** Display name for `aiConfig.providerModel` (which stores the backend model name). */
  providerModelLabel?: string;
}

const GRID_CLASS = 'grid grid-cols-2 rounded-md border border-ods-border bg-ods-card content-lg:grid-cols-4';

/**
 * Five cells: the last one takes the whole bottom row of the two-column grid and sits alone on the second row of
 * the four-column one, so in both layouts every cell but the last has a row below it.
 */
function cellClass(idx: number, count: number) {
  return cn(
    AI_CONFIG_CELL_CLASS,
    idx < count - 1 && 'border-b border-ods-border',
    idx === count - 1 && 'col-span-2 content-lg:col-span-1',
  );
}

/** In a loading scope (or with no configuration yet) every cell draws itself: its label real, its value a bar. */
export function AiSettingsCustomerCard({ aiConfig, view, providerModelLabel }: AiSettingsCustomerCardProps) {
  const faeAvatar = useAgentIdentityIcon('fae')?.url ?? undefined;
  const loading = useLoadingScope() || aiConfig == null || view == null;

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
      <InfoCell
        loading={loading}
        skeletonWidth={AI_CONFIG_VALUE_SKELETON_WIDTH}
        value={view?.assistantName}
        label="Assistant Name"
      />
    </>,
    ...aiConfigCells({ aiConfig, providerModelLabel, loading, providerLabel: 'LLM Provider' }),
    <InfoCell
      key="accent-color"
      loading={loading}
      skeletonWidth={AI_CONFIG_VALUE_SKELETON_WIDTH}
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
