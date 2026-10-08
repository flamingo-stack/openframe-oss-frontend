'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { ArrowRightUpIcon, LockIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type Row,
  SquareAvatar,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { formatDate, formatTime } from '@/lib/format-date';
import { multiSelectFilterFn } from '@/lib/table-filters';
import type { RecordingSummary } from '../../types/session-recording';
import { REMOTE_SESSION_COLUMNS } from '../tabs/device-tab-columns';
import { formatBytes, formatDurationMs } from './format';
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

export interface RemoteSessionColumnsOptions {
  /** The SESSION header's calendar: session-date sort + range. */
  dateFilter: TableDateFilter;
  /** The EMPLOYEE header funnel's options. */
  employeeOptions: FilterOption[];
  /** The clock the "Expires in N hours" countdown reads; ticks in the caller. */
  now: number;
  onOpen: (row: RecordingSummary) => void;
  onDelete: (row: RecordingSummary) => void;
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

/** The EXPIRES cell per Figma 1644-6911: kept, the expiry date (with a countdown on the last day), or expired. */
function ExpiresCell({ row, now }: { row: RecordingSummary; now: number }) {
  if (row.kept) {
    return (
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <LockIcon className="h-6 w-6 shrink-0 text-ods-text-primary" />
        <TruncateText>Kept</TruncateText>
      </div>
    );
  }
  if (row.recordingState === 'expired') return <TruncateText tone="secondary">Expired</TruncateText>;
  if (row.recordingState === 'deleted') return <TruncateText tone="secondary">Deleted</TruncateText>;
  if (row.recordingState !== 'ready' || !row.expiresAt) {
    return (
      <span className="text-h4">
        <EmptyValue />
      </span>
    );
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
 * The Remote Sessions table's columns (Figma 1644-6911): SESSION with the
 * PROCESSING / FAILED tag, EMPLOYEE, DURATION with the size, EXPIRES, and the
 * Delete / Open actions, each enabled only where the row's recording allows it.
 * A row whose recording is gone reads greyed out. The tenant-wide sessions page
 * builds on the same columns, adding its device and customer columns.
 */
export function remoteSessionColumns({
  dateFilter,
  employeeOptions,
  now,
  onOpen,
  onDelete,
}: RemoteSessionColumnsOptions): ColumnDef<RecordingSummary>[] {
  return [
    {
      id: REMOTE_SESSION_COLUMNS.session.id,
      header: () => <DateColumnHeader label={REMOTE_SESSION_COLUMNS.session.header} filter={dateFilter} />,
      // ISO timestamps sort correctly as strings.
      accessorFn: (row: RecordingSummary) => row.startedAt,
      cell: ({ row }: { row: Row<RecordingSummary> }) => {
        const tag = STATE_TAGS[row.original.recordingState];
        return (
          <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
              <TruncateText tone={isRecordingGone(row.original) ? 'secondary' : 'primary'}>
                {formatDate(row.original.startedAt)}
              </TruncateText>
              {tag && <Tag label={tag.label} variant={tag.variant} className="shrink-0" />}
            </div>
            <TruncateText variant="h6" tone="secondary">
              {formatTime(row.original.startedAt)}
            </TruncateText>
          </div>
        );
      },
      enableSorting: true,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.session),
    },
    {
      id: REMOTE_SESSION_COLUMNS.employee.id,
      header: REMOTE_SESSION_COLUMNS.employee.header,
      accessorFn: (row: RecordingSummary) => row.employee.name,
      cell: ({ row }: { row: Row<RecordingSummary> }) => {
        const { name, role, avatarUrl } = row.original.employee;
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
              <TruncateText tone={isRecordingGone(row.original) ? 'secondary' : 'primary'}>{name}</TruncateText>
              {role && (
                <TruncateText variant="h6" tone="secondary">
                  {role}
                </TruncateText>
              )}
            </div>
          </div>
        );
      },
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.employee, { filter: { options: employeeOptions } }),
    },
    {
      id: REMOTE_SESSION_COLUMNS.duration.id,
      header: REMOTE_SESSION_COLUMNS.duration.header,
      // Still-running sessions have no duration yet - sort them last.
      accessorFn: (row: RecordingSummary) => row.durationMs ?? -1,
      cell: ({ row }: { row: Row<RecordingSummary> }) => {
        const { durationMs, sizeBytes } = row.original;
        if (durationMs == null) {
          return (
            <span className="text-h4">
              <EmptyValue />
            </span>
          );
        }
        return (
          <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
            <TruncateText tone={isRecordingGone(row.original) ? 'secondary' : 'primary'}>
              {formatDurationMs(durationMs)}
            </TruncateText>
            {sizeBytes != null && (
              <TruncateText variant="h6" tone="secondary">
                {formatBytes(sizeBytes)}
              </TruncateText>
            )}
          </div>
        );
      },
      enableSorting: true,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.duration),
    },
    {
      id: REMOTE_SESSION_COLUMNS.expires.id,
      header: REMOTE_SESSION_COLUMNS.expires.header,
      accessorFn: (row: RecordingSummary) => expiresFilterValue(row),
      cell: ({ row }: { row: Row<RecordingSummary> }) => <ExpiresCell row={row.original} now={now} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.expires, { filter: { options: EXPIRES_FILTER_OPTIONS } }),
    },
    {
      id: REMOTE_SESSION_COLUMNS.actions.id,
      cell: ({ row }: { row: Row<RecordingSummary> }) => {
        const deletable = canDeleteSession(row.original);
        return (
          <div
            data-no-row-click
            className="pointer-events-auto flex items-center justify-end gap-[var(--spacing-system-mf)]"
          >
            <Button
              variant="outline"
              size="icon"
              // The glyph carries its own colour, so the disabled one dims to the
              // design's dark red itself - the button's disabled tone does not reach it.
              leftIcon={
                <TrashIcon className={cn('h-6 w-6', deletable ? 'text-ods-error' : 'text-ods-error-secondary')} />
              }
              aria-label="Delete recording"
              disabled={!deletable}
              onClick={() => onDelete(row.original)}
            />
            {/* onClick, not `href`: the row itself is a link (rowHref), and an
              anchor nested in an anchor is invalid HTML (hydration error). */}
            <Button
              onClick={() => onOpen(row.original)}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label="Open session recording"
              disabled={!canOpenSession(row.original)}
              className="bg-ods-card"
            />
          </div>
        );
      },
      enableSorting: false,
      meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.actions),
    },
  ];
}
