'use client';

import { LockIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { EntityImage, Skeleton, SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import type { RecordingDetail } from '../../types/session-recording';
import { formatBytes, formatDurationMs } from './format';
import { keepReasonText } from './recording-keep';

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
        'flex min-w-0 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] content-lg:h-20 content-lg:py-0',
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
 * The recording metadata card (Figma 1755-93683): Date / Resolution / Duration /
 * File size over Hostname / Customer / Employee / Expires on. A kept recording
 * does not expire, so its last cell reads who kept it, when and why instead
 * (1755-94111). Four columns in two rows on desktop; the tablet and mobile
 * mockups both collapse it to two columns in four rows, with the row dividers
 * always spanning the card.
 */
export function RecordingMetaCard({ recording }: { recording: RecordingDetail }) {
  const dash = <span className="text-ods-text-secondary">-</span>;

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-ods-border bg-ods-card content-lg:grid-cols-4">
      <MetaCell label="Date">{formatDateTime(recording.startedAt)}</MetaCell>
      <MetaCell label="Resolution">{recording.resolution ?? dash}</MetaCell>
      <MetaCell label="Duration">
        {recording.durationMs != null ? formatDurationMs(recording.durationMs) : dash}
      </MetaCell>
      <MetaCell label="File size">{recording.sizeBytes != null ? formatBytes(recording.sizeBytes) : dash}</MetaCell>
      <MetaCell label="Hostname" className="content-lg:border-b-0">
        {recording.hostname ?? dash}
      </MetaCell>
      <MetaCell
        label="Customer ID (Site)"
        className="content-lg:border-b-0"
        adornment={
          <EntityImage
            src={recording.organization.logoUrl}
            alt={recording.organization.name}
            sizeClassName="size-10"
            className="shrink-0 rounded-[4px] border border-ods-border"
          />
        }
      >
        {recording.organization.id ? (
          <Link
            href={routes.customers.details(recording.organization.id)}
            className="text-ods-accent underline hover:text-ods-accent-hover"
          >
            {recording.organization.name}
          </Link>
        ) : (
          recording.organization.name || dash
        )}
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
      {recording.keep ? (
        <MetaCell
          label={`on ${formatDate(recording.keep.keptAt)} for ${keepReasonText(recording.keep)}`}
          className="border-b-0"
        >
          <span className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
            <LockIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">Kept by {recording.keep.keptBy}</span>
          </span>
        </MetaCell>
      ) : (
        <MetaCell label="Expires on" className="border-b-0">
          {recording.expiresAt ? formatDate(recording.expiresAt) : dash}
        </MetaCell>
      )}
    </div>
  );
}

export function RecordingMetaCardSkeleton() {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-ods-border bg-ods-card content-lg:grid-cols-4">
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
