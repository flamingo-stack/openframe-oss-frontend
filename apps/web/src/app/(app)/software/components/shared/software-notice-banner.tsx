'use client';

import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * The notice row of a software title's page (designs 1100:444, 1239:1238, 1239:20729): the info mark, a bold line and
 * its explanation, and one button. The button goes under the text on a narrow content area, beside it from 720px up.
 */
export function SoftwareNoticeBanner({
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  /** Spacing around it, for a host whose banner may not be there at all. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] content-md:flex-row content-md:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
        <InfoCircleIcon className="size-6 shrink-0 text-ods-text-secondary" />
        <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-ods-text-primary text-h3">{title}</p>
          <p className="text-ods-text-secondary text-h6">{description}</p>
        </div>
      </div>
      <Button variant="outline" href={actionHref} className="shrink-0 self-start content-md:self-auto">
        {actionLabel}
      </Button>
    </div>
  );
}
