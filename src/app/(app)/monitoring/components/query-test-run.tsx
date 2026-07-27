'use client';

import {
  type ColumnDef,
  DataTable,
  NoData,
  type QueryResultRow,
  type Row,
  ScrollShadow,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatTime } from '@/lib/format-date';
import { useLiveCampaign } from '../hooks/use-live-campaign';

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const RESULT_COLUMN_MIN_WIDTH = 176;
const SKELETON_COLUMNS = 6;

/** Column-bar skeleton (header cells + one card row), matching the design:
    fixed 160px columns on every breakpoint, scrolling horizontally when they
    do not fit. Bars use bg-ods-bg-surface like the Devices table skeleton —
    the bg-ods-skeleton token is the same color as the card background and
    would be invisible on the row. */
export function TestResultsSkeleton() {
  return (
    <ScrollShadow axis="horizontal">
      {/* No gap between the header bars and the row card, matching the mock
          and the real table (header and body sit flush). */}
      <div className="flex w-max min-w-full flex-col">
        <div className="flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]">
          {Array.from({ length: SKELETON_COLUMNS }).map((_, i) => (
            <div key={`skeleton-header-${i}`} className="flex h-12 w-[160px] shrink-0 items-center">
              <div className="h-4 w-3/4 rounded-sm bg-ods-bg-surface animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-[6px] border border-ods-border bg-ods-card overflow-hidden animate-pulse">
          {/* Same INNER row heights as the core DataTable (66/78px + the 1px
              card border on each side = 68/80px total, per design). */}
          <div className="flex h-[66px] md:h-[78px] items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]">
            {Array.from({ length: SKELETON_COLUMNS }).map((_, i) => (
              <div key={`skeleton-cell-${i}`} className="w-[160px] shrink-0">
                <div className="h-5 w-3/4 rounded-sm bg-ods-bg-surface" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollShadow>
  );
}

/**
 * Live test results rendered with the same core DataTable used by the Devices
 * tables on this page (identical header, skeleton, and card-row styling).
 * Columns are derived from the keys of the returned rows; wide result sets
 * scroll horizontally.
 */
export function TestResultsTable({ rows, loading }: { rows: QueryResultRow[]; loading: boolean }) {
  const columnKeys = useMemo(() => (rows.length > 0 ? Object.keys(rows[0]) : []), [rows]);

  const columns = useMemo<ColumnDef<QueryResultRow>[]>(() => {
    return columnKeys.map(key => ({
      id: key,
      accessorFn: (row: QueryResultRow) => row[key],
      header: key,
      enableSorting: false,
      cell: ({ row }: { row: Row<QueryResultRow> }) => {
        const value = row.original[key];
        return (
          <span className="text-h4 text-ods-text-primary truncate">
            {value === null || value === undefined ? '-' : String(value)}
          </span>
        );
      },
      meta: {
        width: 'flex-1 min-w-[176px]',
        // This block shows table headers on every breakpoint (unlike the
        // default tables); headerClassName sizes the cells below lg where
        // meta.width is not applied.
        alwaysShowHeader: true,
        headerClassName: 'flex-1 min-w-[176px]',
      },
    }));
  }, [columnKeys]);

  const table = useDataTable<QueryResultRow>({
    data: rows,
    columns,
    getRowId: (_row: QueryResultRow, index: number) => String(index),
    enableSorting: false,
  });

  if (loading) {
    return <TestResultsSkeleton />;
  }

  return (
    <ScrollShadow axis="horizontal">
      <div style={{ minWidth: Math.max(1, columnKeys.length) * RESULT_COLUMN_MIN_WIDTH }}>
        <DataTable table={table}>
          {/* "flex" overrides the header's default "hidden md:flex" — this
              block shows headers on mobile too, per design. */}
          <DataTable.Header className="flex flex-col" />
          <DataTable.Body loading={false} />
        </DataTable>
      </div>
    </ScrollShadow>
  );
}

export interface TestRunResultsProps {
  isActive: boolean;
  displayRows: QueryResultRow[];
  firstError: string | null;
  className?: string;
}

/** Error line + empty state + result table for a finished/running test run. */
export function TestRunResults({ isActive, displayRows, firstError, className }: TestRunResultsProps) {
  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-xsf)]', className)}>
      {firstError && (
        <p role="alert" className="text-h6 text-ods-error">
          {firstError}
        </p>
      )}
      {!isActive && displayRows.length === 0 ? (
        // With zero rows the error line alone explains the outcome; a
        // "No results returned" empty state next to it would mislead.
        // Otherwise: fixed-height empty state matching the 1-row
        // skeleton/result height (48px header + 80px row, no gap) so
        // the block does not jump between loading/result/empty.
        !firstError && (
          <NoData icon={<SearchIcon />} title="No results returned" className="h-[128px] justify-center !py-0" />
        )
      ) : (
        <TestResultsTable rows={displayRows} loading={isActive && displayRows.length === 0} />
      )}
    </div>
  );
}

/** Started / Duration stat cell shown in the test-run controls row. */
export function TimingStat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col justify-center min-w-0', className)}>
      <span className="text-h4 text-ods-text-secondary truncate">{value}</span>
      <span className="text-h6 text-ods-text-secondary truncate">{label}</span>
    </div>
  );
}

/**
 * State machine for one live test run (shared by the Test Query panel on the
 * policy form and the per-device Quick Query panel on policy details): wraps
 * `useLiveCampaign` with the run/stop/reset flow, elapsed-duration ticking,
 * and the display flags the panels render from.
 */
export function useQueryTestRun() {
  const campaign = useLiveCampaign();
  // Sticky "a run has been started" flag: campaignStatus resets to '' for a
  // moment when a new run starts, which would flash the initial Run button
  // between "Test Again" clicks without it.
  const [hasRun, setHasRun] = useState(false);
  // True while startCampaign is creating the campaign (before isRunning
  // flips) — without it the button would flash "Test Again" right after a
  // Run/Test Again click.
  const [isStarting, setIsStarting] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    if (!campaign.startedAt || !campaign.isRunning) {
      if (campaign.startedAt && !campaign.isRunning) {
        setDurationMs(Date.now() - campaign.startedAt.getTime());
      }
      return;
    }
    setDurationMs(Date.now() - campaign.startedAt.getTime());
    const interval = setInterval(() => {
      setDurationMs(Date.now() - campaign.startedAt!.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [campaign.startedAt, campaign.isRunning]);

  const run = useCallback(
    async (query: string, hostIds: number[]) => {
      setHasRun(true);
      setDurationMs(0);
      setIsStarting(true);
      try {
        await campaign.startCampaign(query, hostIds);
      } finally {
        setIsStarting(false);
      }
    },
    [campaign],
  );

  // Stop/reset also drop isStarting so the Stop button doesn't stay "active"
  // for the moment between the user's click and the pending startCampaign
  // promise settling (its finally clears the flag again — harmless).
  const stop = useCallback(() => {
    setIsStarting(false);
    campaign.stopCampaign();
  }, [campaign]);

  /** Stop anything in flight and clear the run state (panel close/cancel). */
  const reset = useCallback(() => {
    setIsStarting(false);
    campaign.stopCampaign();
    setDurationMs(0);
    setHasRun(false);
  }, [campaign]);

  const isActive = campaign.isRunning || isStarting;
  const isFinished = campaign.campaignStatus === 'finished';
  const showResults = isActive || (hasRun && isFinished);

  const firstError = isFinished && campaign.errors.length > 0 ? campaign.errors[0].error : null;

  // Started/Duration show zeros until the current run's timing is real:
  // hasRun=false after a reset, and campaignStatus resets while the next
  // Test Again run is being created, so stale values never linger on screen.
  const showTiming = hasRun && campaign.startedAt !== null && (campaign.isRunning || isFinished);

  const startedLabel = showTiming && campaign.startedAt ? formatTime(campaign.startedAt) : '00:00 PM';
  const durationLabel = showTiming ? formatDuration(durationMs) : '00:00:00';

  // Humanize the raw osquery keys for the table headers (snake_case -> spaced
  // words); the row data itself is shown exactly as returned by the query.
  const displayRows = useMemo<QueryResultRow[]>(
    () =>
      campaign.results.map(row =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_/g, ' '), value])),
      ),
    [campaign.results],
  );

  return {
    hasRun,
    isActive,
    isFinished,
    showResults,
    firstError,
    startedLabel,
    durationLabel,
    displayRows,
    run,
    stop,
    reset,
  };
}
