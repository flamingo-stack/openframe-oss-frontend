'use client';

import { Progress } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

interface SpendLimitBarProps {
  /** How far the last 30 days' auto top-ups have gone into the limit, 0–100. */
  percent: number;
  /** The limit is reached: no refill fits under it until older ones leave the window. */
  reached: boolean;
  /** What the bar measures, for a screen reader: the figures beside it say the same in words. */
  label: string;
}

/**
 * The auto top-ups of the last 30 days against the spend limit, on the billing
 * page under the limit row and in the modal under the limit field: the accent
 * while there is room, the error tone once the limit holds refills back.
 */
export function SpendLimitBar({ percent, reached, label }: SpendLimitBarProps) {
  return (
    <Progress
      variant="step"
      value={percent}
      aria-label={label}
      className="rounded-none"
      indicatorClassName={cn(reached && 'bg-ods-error')}
    />
  );
}
