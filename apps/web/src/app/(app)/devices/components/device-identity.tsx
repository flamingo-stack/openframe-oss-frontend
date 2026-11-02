'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { TitleLines } from '@/app/components/shared';

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
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      {icon}
      <TitleLines title={title} subline={subtitle} sublineSkeletonWidth="w-36" />
    </div>
  );
}
