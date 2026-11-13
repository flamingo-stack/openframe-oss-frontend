'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { RemoteSessionStatusTag } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ArrowRightUpIcon, LockIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  actionColumn,
  Button,
  type ColumnDef,
  DataTable,
  GRID_MIN_WIDTH,
  type Row,
  SquareAvatar,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { GridRowActionButton } from '@/app/components/shared/grid-row-action-button';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { ValueGridCell } from '@/app/components/shared/value-grid-cell';
import { ValueText } from '@/app/components/shared/value-text';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { formatDate, formatTime } from '@/lib/format-date';
import { multiSelectFilterFn } from '@/lib/table-filters';
import type { RecordingSummary } from '../../types/session-recording';
import { formatBytes, formatDurationMs } from './format';
import { keepReasonText } from './recording-keep';
import { REMOTE_SESSION_COLUMNS } from './remote-session-column-layout';
import {
  canDeleteSession,
  EXPIRES_FILTER_OPTIONS,
  expiresFilterValue,
  expiresSoonLabel,
  isLiveRow,
  isRecordingGone,
  type LiveRows,
  sessionHref,
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
  /** Set while Watch live is on: running sessions read LIVE and open the live session page. */
  liveRows: LiveRows | null;
  onOpen: (row: T) => void;
  onDelete: (row: T) => void;
  /**
   * The table's layout. `grid`: Delete and Open are a column each (the grid's action columns, pinned right); `cards`
   * (the default) keeps the one actions column of the card rows.
   */
  layout?: TableLayout;
}

/** The grid's two action columns, in the order they are drawn. */
export const REMOTE_SESSION_GRID_ACTIONS = { delete: 'delete', open: 'open' } as const;

/** A row whose recording is gone reads muted, in a card row and in the grid alike. */
function rowTone(row: RecordingSummary): 'primary' | 'secondary' {
  return isRecordingGone(row) ? 'secondary' : 'primary';
}

function employeeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** The tag beside the session date: LIVE while Watch live shows the session running, else the recording's state. */
function sessionTag(row: RecordingSummary, liveRows: LiveRows | null): 'live' | 'processing' | 'failed' | null {
  if (isLiveRow(row, liveRows)) return 'live';
  if (row.recordingState === 'processing' || row.recordingState === 'failed') return row.recordingState;
  return null;
}

/** A LIVE row's frame, in the error colour like its tag. Merged over the row's own border colour. */
export function liveSessionRowClass(row: RecordingSummary, liveRows: LiveRows | null): string {
  return isLiveRow(row, liveRows) ? 'border-ods-error' : '';
}

/**
 * The EXPIRES cell per Figma 1644-6911: kept (by whom, why), the expiry date (with a countdown on the last day), or
 * expired. A LIVE row has none yet: a running session may already have a file listed, and more may follow.
 */
function ExpiresCell({ row, now, liveRows }: { row: RecordingSummary; now: number; liveRows: LiveRows | null }) {
  // A row still being read: the expiry date's line as a bar (the typical row is a ready recording).
  if (useLoadingScope()) return <TextLineSkeleton type="h4" as="span" className="w-32 max-w-full" />;
  if (isLiveRow(row, liveRows)) return <ValueText value={null} />;
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
 * The SESSION cell: the start date (with the LIVE / PROCESSING / FAILED tag) over its time. On a loading row (a loading
 * scope, every field absent) both lines are bars.
 */
function SessionCell({ row, liveRows }: { row: RecordingSummary; liveRows: LiveRows | null }) {
  if (useLoadingScope()) {
    return (
      <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
        <TextLineSkeleton type="h4" className="w-3/4" />
        <TextLineSkeleton type="h6" className="w-1/2" />
      </div>
    );
  }
  const tag = sessionTag(row, liveRows);
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
        <TruncateText tone={isRecordingGone(row) ? 'secondary' : 'primary'}>{formatDate(row.startedAt)}</TruncateText>
        {tag && <RemoteSessionStatusTag status={tag} />}
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
 * Delete / Open, each enabled only where the row allows it: Delete by its recording, Open where it has a page to open
 * (`sessionHref`). Static chrome: on a loading row both are drawn real and inert (a placeholder would otherwise read as
 * deletable).
 */
function SessionActions<T extends RecordingSummary>({
  row,
  liveRows,
  onOpen,
  onDelete,
}: {
  row: T;
  liveRows: LiveRows | null;
  onOpen: (row: T) => void;
  onDelete: (row: T) => void;
}) {
  const loading = useLoadingScope();
  const deletable = !loading && canDeleteSession(row);
  const openLabel = isLiveRow(row, liveRows) ? 'Watch live' : 'Open session recording';
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
        aria-label={openLabel}
        disabled={loading || sessionHref(row, liveRows) === null}
        className="bg-ods-card"
      />
    </div>
  );
}

/** The grid's one line: the start date, its LIVE / PROCESSING / FAILED tag, then the time. */
function SessionGridCell({ row, liveRows }: { row: RecordingSummary; liveRows: LiveRows | null }) {
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  const tag = sessionTag(row, liveRows);
  return (
    <DataTable.Cell
      text={formatDate(row.startedAt)}
      tone={rowTone(row)}
      tag={tag ? <RemoteSessionStatusTag status={tag} /> : undefined}
      secondary={formatTime(row.startedAt)}
    />
  );
}

/** The grid's one line: the employee's avatar and name, the role after it. */
function EmployeeGridCell({ row }: { row: RecordingSummary }) {
  const loading = useLoadingScope();
  const { name = '', role, avatarUrl } = row.employee ?? {};
  if (!loading && !name) return <ValueGridCell value={null} />;
  return (
    <DataTable.Cell
      leading={{ type: 'avatar', src: avatarUrl, name }}
      text={name}
      tone={rowTone(row)}
      secondary={role || undefined}
    />
  );
}

/** The grid's one line: the length, the file size after it. */
function DurationGridCell({ row }: { row: RecordingSummary }) {
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  if (row.durationMs == null) return <ValueGridCell value={null} />;
  return (
    <DataTable.Cell
      text={formatDurationMs(row.durationMs)}
      tone={rowTone(row)}
      secondary={row.sizeBytes != null ? formatBytes(row.sizeBytes) : undefined}
    />
  );
}

/**
 * The grid's one line of `ExpiresCell`: kept (the lock, then by whom and why), the expiry date (its countdown after it
 * on the last day), or expired / deleted. A LIVE row has none yet.
 */
function ExpiresGridCell({ row, now, liveRows }: { row: RecordingSummary; now: number; liveRows: LiveRows | null }) {
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  if (isLiveRow(row, liveRows)) return <ValueGridCell value={null} />;
  if (row.kept) {
    return (
      <DataTable.Cell
        leading={{ type: 'icon', icon: <LockIcon className="size-5 text-ods-text-primary" /> }}
        text="Kept"
        secondary={row.keep ? `by ${row.keep.keptBy} · ${keepReasonText(row.keep)}` : undefined}
      />
    );
  }
  if (row.recordingState === 'expired') return <DataTable.Cell text="Expired" tone="secondary" />;
  if (row.recordingState === 'deleted') return <DataTable.Cell text="Deleted" tone="secondary" />;
  if (row.recordingState !== 'ready' || !row.expiresAt) return <ValueGridCell value={null} />;
  return (
    <DataTable.Cell text={formatDate(row.expiresAt)} secondary={expiresSoonLabel(row.expiresAt, now) ?? undefined} />
  );
}

/**
 * The Remote Sessions table's columns (Figma 1644-6911): SESSION with the
 * LIVE / PROCESSING / FAILED tag, EMPLOYEE, DURATION with the size, EXPIRES, and
 * the Delete / Open actions, each enabled only where the row allows it.
 * A row whose recording is gone reads greyed out. The tenant-wide sessions page
 * builds on the same columns, adding its device and customer columns.
 */
export function remoteSessionColumns<T extends RecordingSummary = RecordingSummary>({
  dateFilter,
  employeeOptions,
  now,
  liveRows,
  onOpen,
  onDelete,
  layout = 'cards',
}: RemoteSessionColumnsOptions<T>): ColumnDef<T>[] {
  // The card rows hold both buttons in one cell; the grid gives each action a column of its own.
  const actionColumns: ColumnDef<T>[] =
    layout === 'grid'
      ? [
          actionColumn<T>({
            id: REMOTE_SESSION_GRID_ACTIONS.delete,
            cell: ({ row }) => {
              const deletable = canDeleteSession(row.original);
              return (
                <GridRowActionButton
                  label="Delete session"
                  // The glyph carries its own colour: the disabled one dims to the design's dark red itself.
                  icon={
                    <TrashIcon className={cn('h-6 w-6', deletable ? 'text-ods-error' : 'text-ods-error-secondary')} />
                  }
                  disabled={!deletable}
                  onClick={() => onDelete(row.original)}
                />
              );
            },
          }),
          actionColumn<T>({
            id: REMOTE_SESSION_GRID_ACTIONS.open,
            cell: ({ row }) => (
              <OpenRowButton
                grid
                label={isLiveRow(row.original, liveRows) ? 'Watch live' : 'Open session recording'}
                disabled={sessionHref(row.original, liveRows) === null}
                onClick={() => onOpen(row.original)}
              />
            ),
          }),
        ]
      : [
          {
            id: REMOTE_SESSION_COLUMNS.actions.id,
            cell: ({ row }: { row: Row<T> }) => (
              <SessionActions row={row.original} liveRows={liveRows} onOpen={onOpen} onDelete={onDelete} />
            ),
            enableSorting: false,
            meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.actions),
          },
        ];

  return [
    {
      id: REMOTE_SESSION_COLUMNS.session.id,
      header: () => <DateColumnHeader label={REMOTE_SESSION_COLUMNS.session.header} filter={dateFilter} />,
      // ISO timestamps sort correctly as strings.
      accessorFn: (row: T) => row.startedAt,
      cell: ({ row }: { row: Row<T> }) => <SessionCell row={row.original} liveRows={liveRows} />,
      enableSorting: true,
      size: 260,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.session, {
        label: 'Session',
        gridCell: ({ row }: { row: Row<T> }) => <SessionGridCell row={row.original} liveRows={liveRows} />,
      }),
    },
    {
      id: REMOTE_SESSION_COLUMNS.employee.id,
      header: REMOTE_SESSION_COLUMNS.employee.header,
      accessorFn: (row: T) => row.employee?.name,
      cell: ({ row }: { row: Row<T> }) => <EmployeeCell row={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 260,
      minSize: GRID_MIN_WIDTH.media,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.employee, {
        label: 'Employee',
        filter: { options: employeeOptions },
        gridCell: ({ row }: { row: Row<T> }) => <EmployeeGridCell row={row.original} />,
      }),
    },
    {
      id: REMOTE_SESSION_COLUMNS.duration.id,
      header: REMOTE_SESSION_COLUMNS.duration.header,
      // Still-running sessions have no duration yet - sort them last.
      accessorFn: (row: T) => row.durationMs ?? -1,
      cell: ({ row }: { row: Row<T> }) => <DurationCell row={row.original} />,
      enableSorting: true,
      size: 180,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.duration, {
        label: 'Duration',
        gridCell: ({ row }: { row: Row<T> }) => <DurationGridCell row={row.original} />,
      }),
    },
    {
      id: REMOTE_SESSION_COLUMNS.expires.id,
      header: REMOTE_SESSION_COLUMNS.expires.header,
      accessorFn: (row: T) => expiresFilterValue(row, now),
      cell: ({ row }: { row: Row<T> }) => <ExpiresCell row={row.original} now={now} liveRows={liveRows} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      size: 300,
      minSize: GRID_MIN_WIDTH.icon,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.expires, {
        label: 'Recording expires',
        filter: { options: EXPIRES_FILTER_OPTIONS },
        gridCell: ({ row }: { row: Row<T> }) => <ExpiresGridCell row={row.original} now={now} liveRows={liveRows} />,
      }),
    },
    ...actionColumns,
  ];
}
