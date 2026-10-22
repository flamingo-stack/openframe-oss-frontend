'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ArrowRightUpIcon, LockIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type Row,
  SquareAvatar,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { ValueText } from '@/app/components/shared/value-text';
import { formatDate, formatTime } from '@/lib/format-date';
import { multiSelectFilterFn } from '@/lib/table-filters';
import type { RecordingSummary } from '../../types/session-recording';
import { formatBytes, formatDurationMs } from './format';
import { keepReasonText } from './recording-keep';
import { REMOTE_SESSION_COLUMNS } from './remote-session-column-layout';
import {
  canDeleteSession,
  canOpenSession,
  EXPIRES_FILTER_OPTIONS,
  expiresFilterValue,
  expiresSoonLabel,
  isRecordingGone,
} from './session-status';

interface FilterOption {
  id: string;
  value: string;
  label: string;
}

export interface RemoteSessionColumnsOptions<T extends RecordingSummary = RecordingSummary> {
  /** The SESSION header's calendar: session-date sort + range. */
  dateFilter: TableDateFilter;
  /** The EMPLOYEE header funnel's options. */
  employeeOptions: FilterOption[];
  /** The clock the "Expires in N hours" countdown reads; ticks in the caller. */
  now: number;
  onOpen: (row: T) => void;
  onDelete: (row: T) => void;
}

function employeeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

const STATE_TAGS: Partial<Record<RecordingSummary['recordingState'], { label: string; variant: 'warning' | 'error' }>> =
  {
    processing: { label: 'PROCESSING', variant: 'warning' },
    failed: { label: 'FAILED', variant: 'error' },
  };

/** The EXPIRES cell per Figma 1644-6911: kept (by whom, why), the expiry date (with a countdown on the last day), or expired. */
function ExpiresCell({ row, now }: { row: RecordingSummary; now: number }) {
  // A row still being read: the expiry date's line as a bar (the typical row is a ready recording).
  if (useLoadingScope()) return <TextLineSkeleton type="h4" as="span" className="w-32 max-w-full" />;
  if (row.kept) {
    return (
      <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <LockIcon className="h-6 w-6 shrink-0 text-ods-text-primary" />
          <TruncateText>Kept</TruncateText>
        </div>
        {row.keep && (
          <TruncateText variant="h6" tone="secondary">
            {`Kept by ${row.keep.keptBy} · ${keepReasonText(row.keep)}`}
          </TruncateText>
        )}
      </div>
    );
  }
  if (row.recordingState === 'expired') return <TruncateText tone="secondary">Expired</TruncateText>;
  if (row.recordingState === 'deleted') return <TruncateText tone="secondary">Deleted</TruncateText>;
  if (row.recordingState !== 'ready' || !row.expiresAt) {
    return <ValueText value={null} />;
  }
  const soon = expiresSoonLabel(row.expiresAt, now);
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <TruncateText>{formatDate(row.expiresAt)}</TruncateText>
      {soon && (
        <TruncateText variant="h6" tone="secondary">
          {soon}
        </TruncateText>
      )}
    </div>
  );
}

/**
 * The SESSION cell: the start date (with the PROCESSING / FAILED tag) over its time. On a loading row (a loading scope,
 * every field absent) both lines are bars.
 */
function SessionCell({ row }: { row: RecordingSummary }) {
  if (useLoadingScope()) {
    return (
      <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
        <TextLineSkeleton type="h4" className="w-3/4" />
        <TextLineSkeleton type="h6" className="w-1/2" />
      </div>
    );
  }
  const tag = STATE_TAGS[row.recordingState];
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
        <TruncateText tone={isRecordingGone(row) ? 'secondary' : 'primary'}>{formatDate(row.startedAt)}</TruncateText>
        {tag && <Tag label={tag.label} variant={tag.variant} className="shrink-0" />}
      </div>
      <TruncateText variant="h6" tone="secondary">
        {formatTime(row.startedAt)}
      </TruncateText>
    </div>
  );
}

/** The EMPLOYEE cell: avatar, name and role. On a loading row the avatar and the two lines draw their own loading forms. */
function EmployeeCell({ row }: { row: RecordingSummary }) {
  const loading = useLoadingScope();
  const { name = '', role, avatarUrl } = row.employee ?? {};
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
      <SquareAvatar
        variant="round"
        size="md"
        src={avatarUrl}
        fallback={employeeInitials(name)}
        alt={name}
        initialsClassName="text-ods-text-secondary"
      />
      <div className="flex min-w-0 flex-col justify-center">
        <TruncateText tone={isRecordingGone(row) ? 'secondary' : 'primary'}>{name}</TruncateText>
        {(loading || role) && (
          <TruncateText variant="h6" tone="secondary">
            {role ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/** The DURATION cell: the length over the file size. On a loading row both lines are bars. */
function DurationCell({ row }: { row: RecordingSummary }) {
  if (useLoadingScope()) {
    return (
      <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
        <TextLineSkeleton type="h4" className="w-3/4" />
        <TextLineSkeleton type="h6" className="w-1/2" />
      </div>
    );
  }
  const { durationMs, sizeBytes } = row;
  if (durationMs == null) {
    return <ValueText value={null} />;
  }
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <TruncateText tone={isRecordingGone(row) ? 'secondary' : 'primary'}>{formatDurationMs(durationMs)}</TruncateText>
      {sizeBytes != null && (
        <TruncateText variant="h6" tone="secondary">
          {formatBytes(sizeBytes)}
        </TruncateText>
      )}
    </div>
  );
}

/**
 * Delete / Open, each enabled only where the row's recording allows it. Static chrome: on a loading row both are drawn
 * real and inert (a placeholder would otherwise read as deletable).
 */
function SessionActions<T extends RecordingSummary>({
  row,
  onOpen,
  onDelete,
}: {
  row: T;
  onOpen: (row: T) => void;
  onDelete: (row: T) => void;
}) {
  const loading = useLoadingScope();
  const deletable = !loading && canDeleteSession(row);
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-[var(--spacing-system-mf)]">
      <Button
        variant="outline"
        size="icon"
        // The glyph carries its own colour, so the disabled one dims to the
        // design's dark red itself - the button's disabled tone does not reach it.
        leftIcon={<TrashIcon className={cn('h-6 w-6', deletable ? 'text-ods-error' : 'text-ods-error-secondary')} />}
        aria-label="Delete session"
        disabled={!deletable}
        onClick={() => onDelete(row)}
      />
      {/* onClick, not `href`: the row itself is a link (rowHref), and an
        anchor nested in an anchor is invalid HTML (hydration error). */}
      <Button
        onClick={() => onOpen(row)}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open session recording"
        disabled={loading || !canOpenSession(row)}
        className="bg-ods-card"
      />
    </div>
  );
}

/**
 * The Remote Sessions table's columns (Figma 1644-6911): SESSION with the
 * PROCESSING / FAILED tag, EMPLOYEE, DURATION with the size, EXPIRES, and the
 * Delete / Open actions, each enabled only where the row's recording allows it.
 * A row whose recording is gone reads greyed out. The tenant-wide sessions page
 * builds on the same columns, adding its device and customer columns.
 */
export function remoteSessionColumns<T extends RecordingSummary = RecordingSummary>({
  dateFilter,
  employeeOptions,
  now,
  onOpen,
  onDelete,
}: RemoteSessionColumnsOptions<T>): ColumnDef<T>[] {
  return [
    {
      id: REMOTE_SESSION_COLUMNS.session.id,
      header: () => <DateColumnHeader label={REMOTE_SESSION_COLUMNS.session.header} filter={dateFilter} />,
      // ISO timestamps sort correctly as strings.
      accessorFn: (row: T) => row.startedAt,
      cell: ({ row }: { row: Row<T> }) => <SessionCell row={row.original} />,
      enableSorting: true,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.session),
    },
    {
      id: REMOTE_SESSION_COLUMNS.employee.id,
      header: REMOTE_SESSION_COLUMNS.employee.header,
      accessorFn: (row: T) => row.employee?.name,
      cell: ({ row }: { row: Row<T> }) => <EmployeeCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.employee, { filter: { options: employeeOptions } }),
    },
    {
      id: REMOTE_SESSION_COLUMNS.duration.id,
      header: REMOTE_SESSION_COLUMNS.duration.header,
      // Still-running sessions have no duration yet - sort them last.
      accessorFn: (row: T) => row.durationMs ?? -1,
      cell: ({ row }: { row: Row<T> }) => <DurationCell row={row.original} />,
      enableSorting: true,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.duration),
    },
    {
      id: REMOTE_SESSION_COLUMNS.expires.id,
      header: REMOTE_SESSION_COLUMNS.expires.header,
      accessorFn: (row: T) => expiresFilterValue(row, now),
      cell: ({ row }: { row: Row<T> }) => <ExpiresCell row={row.original} now={now} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.expires, { filter: { options: EXPIRES_FILTER_OPTIONS } }),
    },
    {
      id: REMOTE_SESSION_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<T> }) => <SessionActions row={row.original} onOpen={onOpen} onDelete={onDelete} />,
      enableSorting: false,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.actions),
    },
  ];
}
