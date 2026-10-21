'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { LockIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  EntityImage,
  EntityImageSkeleton,
  SquareAvatar,
  SquareAvatarSkeleton,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
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
const CARD_CLASS =
  'grid grid-cols-2 overflow-hidden rounded-[6px] border border-ods-border bg-ods-card content-lg:grid-cols-4';

/** The employee's avatar: a step of the shared avatar scale (`AVATAR_SIZE`), drawn and held at one size. */
const EMPLOYEE_AVATAR_SIZE = 'sm';
const CUSTOMER_LOGO_SIZE = 'size-10';
const CUSTOMER_LOGO_CLASS = 'shrink-0 rounded-[4px] border border-ods-border';

export function RecordingMetaCard({ recording }: { recording: RecordingDetail | null }) {
  // The recording has not answered (the page's loading scope): the same cells with their real labels, each value a
  // text bar and the logo and avatar their own placeholders.
  const loading = useLoadingScope() || !recording;
  const bar = <TextLineSkeleton type="h4" as="span" className="w-28" />;
  const dash = <span className="text-ods-text-secondary">-</span>;
  const value = (read: (recording: RecordingDetail) => ReactNode) => (recording && !loading ? read(recording) : bar);

  return (
    <div className={CARD_CLASS}>
      <MetaCell label="Date">{value(r => formatDateTime(r.startedAt))}</MetaCell>
      <MetaCell label="Resolution">{value(r => r.resolution ?? dash)}</MetaCell>
      <MetaCell label="Duration">{value(r => (r.durationMs != null ? formatDurationMs(r.durationMs) : dash))}</MetaCell>
      <MetaCell label="File size">{value(r => (r.sizeBytes != null ? formatBytes(r.sizeBytes) : dash))}</MetaCell>
      <MetaCell label="Hostname" className="content-lg:border-b-0">
        {value(r => r.hostname ?? dash)}
      </MetaCell>
      <MetaCell
        label="Customer ID (Site)"
        className="content-lg:border-b-0"
        adornment={
          recording && !loading ? (
            <EntityImage
              src={recording.organization.logoUrl}
              alt={recording.organization.name}
              sizeClassName={CUSTOMER_LOGO_SIZE}
              className={CUSTOMER_LOGO_CLASS}
            />
          ) : (
            <EntityImageSkeleton sizeClassName={CUSTOMER_LOGO_SIZE} className={CUSTOMER_LOGO_CLASS} />
          )
        }
      >
        {value(r =>
          r.organization.id ? (
            <Link
              href={routes.customers.details(r.organization.id)}
              className="text-ods-accent underline hover:text-ods-accent-hover"
            >
              {r.organization.name}
            </Link>
          ) : (
            r.organization.name || dash
          ),
        )}
      </MetaCell>
      <MetaCell
        label="Employee"
        className="border-b-0"
        adornment={
          recording && !loading ? (
            <SquareAvatar
              variant="round"
              size={EMPLOYEE_AVATAR_SIZE}
              src={recording.employee.avatarUrl}
              alt={recording.employee.name}
              className="shrink-0"
            />
          ) : (
            <SquareAvatarSkeleton variant="round" size={EMPLOYEE_AVATAR_SIZE} className="shrink-0" />
          )
        }
      >
        {value(r => r.employee.name)}
      </MetaCell>
      {recording && !loading && recording.keep ? (
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
          {value(r => (r.expiresAt ? formatDate(r.expiresAt) : dash))}
        </MetaCell>
      )}
    </div>
  );
}
