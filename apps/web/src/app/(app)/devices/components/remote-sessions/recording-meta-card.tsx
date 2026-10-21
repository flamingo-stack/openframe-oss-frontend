'use client';

import { LockIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, SquareAvatar, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { formatDate, formatDateTime } from '@/lib/format-date';
import type { RecordingDetail } from '../../types/session-recording';
import { CustomerInfoCell } from '../customer-info-cell';
import { formatBytes, formatDurationMs } from './format';
import { keepReasonText } from './recording-keep';

/** One cell's frame: the row divider and padding of the card's grid. The cell inside is an `InfoCell`. */
function MetaFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        // Mobile rows are content-height with a 12px vertical padding
        // (Figma 775-50723); desktop rows are the fixed 80px cells.
        'flex min-w-0 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] content-lg:h-20 content-lg:py-0',
        className,
      )}
    >
      {children}
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

export function RecordingMetaCard({ recording }: { recording: RecordingDetail | null }) {
  // Until the recording answers (or in the page's loading scope) the card draws itself in a scope: the same cells with
  // their real labels, each value, the logo and the avatar their own loading states.
  const r = useLoadingScope() ? null : recording;

  return (
    <LoadingWhen loading={!r}>
      <div className={CARD_CLASS}>
        <MetaFrame>
          <InfoCell label="Date" value={r && formatDateTime(r.startedAt)} />
        </MetaFrame>
        <MetaFrame>
          <InfoCell label="Resolution" value={r?.resolution} />
        </MetaFrame>
        <MetaFrame>
          <InfoCell label="Duration" value={r?.durationMs != null ? formatDurationMs(r.durationMs) : null} />
        </MetaFrame>
        <MetaFrame>
          <InfoCell label="File size" value={r?.sizeBytes != null ? formatBytes(r.sizeBytes) : null} />
        </MetaFrame>
        <MetaFrame className="content-lg:border-b-0">
          <InfoCell label="Hostname" value={r?.hostname} />
        </MetaFrame>
        <MetaFrame className="content-lg:border-b-0">
          <CustomerInfoCell customer={r?.organization ?? null} />
        </MetaFrame>
        <MetaFrame className="border-b-0">
          <SquareAvatar
            variant="round"
            size={EMPLOYEE_AVATAR_SIZE}
            src={r?.employee.avatarUrl}
            alt={r?.employee.name ?? ''}
            className="shrink-0"
          />
          <InfoCell label="Employee" value={r?.employee.name} />
        </MetaFrame>
        <MetaFrame className="border-b-0">
          {r?.keep ? (
            <InfoCell
              label={`on ${formatDate(r.keep.keptAt)} for ${keepReasonText(r.keep)}`}
              icon={<LockIcon className="h-4 w-4" />}
              value={`Kept by ${r.keep.keptBy}`}
            />
          ) : (
            <InfoCell label="Expires on" value={r?.expiresAt ? formatDate(r.expiresAt) : null} />
          )}
        </MetaFrame>
      </div>
    </LoadingWhen>
  );
}
