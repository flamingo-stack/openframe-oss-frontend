'use client';

import { EntityImage, Skeleton, SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import type { RecordingDetail } from '../../types/session-recording';
import { formatBytes, formatDurationMs } from './format';

interface MetaCellProps {
  label: string;
  adornment?: ReactNode;
  children: ReactNode;
  /** Extra classes on the cell - the responsive row-divider logic lives here. */
  className?: string;
}

function MetaCell({ label, adornment, children, className }: MetaCellProps) {
  return (
    <div
      className={cn(
        // Mobile rows are content-height with a 12px vertical padding
        // (Figma 775-50723); desktop rows are the fixed 80px cells.
        'flex min-w-0 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] lg:h-20 lg:py-0',
        className,
      )}
    >
      {adornment}
      <div className="flex min-w-0 flex-col justify-center">
        <div className="truncate text-ods-text-primary text-h4">{children}</div>
        <span className="truncate text-ods-text-secondary text-h6">{label}</span>
      </div>
    </div>
  );
}

/**
 * The recording metadata card (Figma 758-46357): Date / Resolution / Duration /
 * File size over Hostname / Customer / Logged-In User / Employee. Four columns
 * in two rows on desktop; the tablet and mobile mockups both collapse it to
 * two columns in four rows, with the row dividers always spanning the card.
 */
export function RecordingMetaCard({ recording }: { recording: RecordingDetail }) {
  const dash = <span className="text-ods-text-secondary">-</span>;

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-ods-border bg-ods-card lg:grid-cols-4">
      <MetaCell label="Date">{formatDateTime(recording.startedAt)}</MetaCell>
      <MetaCell label="Resolution">{recording.resolution ?? dash}</MetaCell>
      <MetaCell label="Duration">
        {recording.durationMs != null ? formatDurationMs(recording.durationMs) : dash}
      </MetaCell>
      <MetaCell label="File size">{recording.sizeBytes != null ? formatBytes(recording.sizeBytes) : dash}</MetaCell>
      <MetaCell label="Hostname" className="lg:border-b-0">
        {recording.hostname}
      </MetaCell>
      <MetaCell
        label="Customer ID (Site)"
        className="lg:border-b-0"
        adornment={
          <EntityImage
            src={recording.organization.logoUrl}
            alt={recording.organization.name}
            sizeClassName="size-10"
            className="shrink-0 rounded-[4px] border border-ods-border"
          />
        }
      >
        <Link
          href={routes.customers.details(recording.organization.id)}
          className="text-ods-accent underline hover:text-ods-accent-hover"
        >
          {recording.organization.name}
        </Link>
      </MetaCell>
      <MetaCell label="Logged-In User" className="border-b-0">
        {recording.loggedInUser ?? dash}
      </MetaCell>
      <MetaCell
        label="Employee"
        className="border-b-0"
        adornment={
          <SquareAvatar
            variant="round"
            sizePx={32}
            src={recording.employee.avatarUrl}
            alt={recording.employee.name}
            className="shrink-0"
          />
        }
      >
        {recording.employee.name}
      </MetaCell>
    </div>
  );
}

export function RecordingMetaCardSkeleton() {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-ods-border bg-ods-card lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="flex h-20 flex-col justify-center gap-[var(--spacing-system-xxs)] border-b border-ods-border px-[var(--spacing-system-m)] last:border-b-0"
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
