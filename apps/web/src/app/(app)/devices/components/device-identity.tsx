'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';

interface DeviceIdentityProps {
  /** The tool's icon tile, drawn as is while the device is read (it is not read data). */
  icon: ReactNode;
  title: string;
  subtitle: string;
  /** The gap between the tile and the text. */
  className?: string;
}

/**
 * Which device a remote tool shows: its icon tile beside the device name over a secondary line. In the page's loading
 * scope the name and the line are text bars; the tile stays.
 */
export function DeviceIdentity({ icon, title, subtitle, className }: DeviceIdentityProps) {
  const loading = useLoadingScope();
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      {icon}
      <div className="flex min-w-0 flex-col">
        {loading ? <TextLineSkeleton type="h4" className="w-48" /> : <TruncateText>{title}</TruncateText>}
        {loading ? (
          <TextLineSkeleton type="h6" className="w-36" />
        ) : (
          <TruncateText variant="h6" tone="secondary">
            {subtitle}
          </TruncateText>
        )}
      </div>
    </div>
  );
}
