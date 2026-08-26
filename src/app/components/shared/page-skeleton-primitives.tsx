'use client';

import {
  type ColumnDef,
  DataTable,
  type PageActionButton,
  PageLayout,
  Skeleton,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { DateColumnHeader } from './date-column-header';
import { skeletonColumnMeta, type TableSkeletonColumn } from './table-column-layout';

/**
 * Building blocks shared by the page skeletons that stand in for a loading route.
 *
 * The principle is the one already used by the dashboard/device/customer
 * skeletons: render the REAL chrome (`PageLayout`, `DataTable`) with static,
 * non-query-dependent content — titles, column headers, disabled action
 * buttons — and skeleton only what actually comes from the request. The page
 * skeleton is then identical in height and column layout to the loaded page, so
 * nothing shifts when the data arrives.
 */

/**
 * Exact wrapper of `DashboardInfoCard`'s own `baseClassName`. Copied rather
 * than imported because the lib doesn't export it — keep the two in step.
 * The fixed height is the part that matters: a placeholder sized by its content
 * is ~33px shorter than the real 104px card, so everything under the stats row
 * shifts when the data lands.
 */
const INFO_CARD_CLASS =
  'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-xsf)] md:p-[var(--spacing-system-m)] h-16 md:h-[104px] flex gap-[var(--spacing-system-s)] md:gap-[var(--spacing-system-m)] items-center transition-all';

/**
 * Inline skeleton bar, phrasing-valid (`<span>`) so it can live INSIDE the real
 * `<p>` typography elements. A `<Skeleton>` renders a `<div>`, which is invalid
 * inside a `<p>` and a hydration error. `align-middle` centers it on the
 * baseline; the surrounding element's line box sets the height.
 */
export function InlineSkeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block max-w-full animate-pulse rounded-md bg-ods-border align-middle', className)}
    />
  );
}

export interface InfoCardSkeletonProps {
  /** Real, static card title — it isn't query-dependent, so render it verbatim. */
  title?: string;
  /** Node rendered in place of the title (e.g. a status tag). */
  titleSlot?: ReactNode;
  /** Reserve the secondary text beside the value (e.g. "12 entries"). */
  showSubValue?: boolean;
  showProgress?: boolean;
  showPercentage?: boolean;
  /** Forwarded to the value `<p>`, mirroring the real card's prop. */
  valueClassName?: string;
  className?: string;
}

/**
 * One `DashboardInfoCard` in its loading state, mirroring the real card's
 * markup: the title stays REAL text and only the request-dependent parts
 * (value, sub-value, percentage, progress ring) become bars — so the card is
 * identical in height to the loaded one by construction.
 */
export function InfoCardSkeleton({
  title,
  titleSlot,
  showSubValue = false,
  showProgress = false,
  showPercentage = false,
  valueClassName,
  className,
}: InfoCardSkeletonProps) {
  return (
    <div className={cn(INFO_CARD_CLASS, className)}>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-[var(--spacing-system-xxs)]">
          {titleSlot ?? <p className="text-h5 text-ods-text-secondary truncate">{title}</p>}
        </div>
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className={cn('text-h3 md:text-h2 text-ods-text-primary truncate', valueClassName)}>
            <InlineSkeleton className="h-4 w-8 md:h-6" />
          </p>
          {showSubValue && (
            <p className="text-h6 text-ods-text-secondary">
              <InlineSkeleton className="h-3 w-16" />
            </p>
          )}
          {showPercentage && (
            <p className="text-h4 text-ods-text-secondary">
              <InlineSkeleton className="h-3 w-14" />
            </p>
          )}
        </div>
      </div>
      {showProgress && <Skeleton className="size-6 shrink-0 rounded-full md:size-14" />}
    </div>
  );
}

export type { TableSkeletonColumn } from './table-column-layout';

const EMPTY_SKELETON_ROWS: unknown[] = [];

/**
 * Column defs for a skeleton table, from a shared column layout.
 *
 * Every skeleton that stands in for a `DataTable` builds its columns through
 * here — the simple ones via `TableSkeleton` below, and the pages' own inline
 * `<Suspense>` fallbacks (which need their table's `stickyHeader`, so they render
 * `DataTable` themselves) by calling this directly. One mapping, so
 * a column's header/width/`hideAt`/`sortable` can't be reproduced correctly in
 * one loading state and wrongly in the other.
 */
export function skeletonColumnDefs<T>(columns: readonly TableSkeletonColumn[]): ColumnDef<T>[] {
  return columns.map(column => {
    const label = column.header ?? '';
    return {
      id: column.id,
      // A date-filtered column keeps its calendar while loading, drawn inert:
      // the popover needs no data, and a bare label would re-center the moment
      // the real one replaced it. Same reasoning as `filterable` above.
      header: column.dateFilterable && label ? () => <DateColumnHeader label={label} /> : label,
      enableSorting: false,
      meta: skeletonColumnMeta(column),
    };
  });
}

interface TableSkeletonProps {
  columns: readonly TableSkeletonColumn[];
  rows?: number;
}

/**
 * Empty `DataTable` in its loading state, shaped by `columns`. Pass the same
 * headers/widths the real table declares so the header row is pixel-identical.
 *
 * The `aria-busy` wrapper is the only element added over a bare `DataTable`:
 * `DataTableSkeleton` renders purely visual `animate-pulse` rows with no
 * `aria-busy`/`aria-live`/`role`, so without it a screen reader is given no
 * signal that the region is loading. `DataTable` takes only
 * `table`/`children`/`className`, so the attribute needs its own element. It
 * wraps a single child, so the flex-item count of the parent is unchanged.
 */
export function TableSkeleton({ columns, rows = 10 }: TableSkeletonProps) {
  const columnDefs = useMemo<ColumnDef<unknown>[]>(() => skeletonColumnDefs<unknown>(columns), [columns]);

  const table = useDataTable<unknown>({
    data: EMPTY_SKELETON_ROWS,
    columns: columnDefs,
    getRowId: () => '',
    enableSorting: false,
  });

  return (
    <div aria-busy>
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body loading skeletonRows={rows} emptyMessage="" rowClassName="mb-1" />
      </DataTable>
    </div>
  );
}

/**
 * Tab bar placeholder for the pages whose `TabNavigation` sits ABOVE the page
 * header (customers, monitoring, scripts, notifications). Mirrors
 * `TabNavigation`'s h-14 bar with icon + label cells; `widths` sets each cell's
 * width so the bar matches the real labels.
 */
export function TabBarSkeleton({ widths, className }: { widths: readonly string[]; className?: string }) {
  return (
    <div className={cn('relative w-full h-14 border-b border-ods-border', className)}>
      <div className="flex gap-1 items-center h-full overflow-hidden">
        {widths.map((width, index) => (
          <div key={index} className={cn('flex gap-2 items-center justify-center p-4 shrink-0 h-14', width)}>
            <Skeleton className="h-6 w-6 shrink-0" />
            <Skeleton className="h-5 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The search/filter toolbar row list pages render above their table. */
export function SearchBarSkeleton() {
  return <Skeleton className="h-12 w-full rounded-md" />;
}

export interface ListPageSkeletonProps {
  /** Real page title — static text, so it renders as-is instead of a bar. */
  title: string;
  /** Real header buttons, rendered disabled so the header is pixel-identical. */
  actions?: PageActionButton[];
  /** Tab cell widths when the page renders a tab bar above its header. */
  tabWidths?: readonly string[];
  columns: readonly TableSkeletonColumn[];
  rows?: number;
}

/**
 * The shape almost every list page loads into: an optional tab bar, the real
 * `PageLayout` header (title + disabled actions), a search toolbar and a table
 * in its loading state.
 */
export function ListPageSkeleton({ title, actions, tabWidths, columns, rows }: ListPageSkeletonProps) {
  return (
    <div className="flex flex-col w-full">
      {tabWidths && (
        <div className="px-[var(--spacing-system-l)]">
          <TabBarSkeleton widths={tabWidths} />
        </div>
      )}
      <PageLayout
        title={title}
        actions={actions}
        actionsVariant="icon-buttons"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        contentClassName="flex flex-col"
      >
        <SearchBarSkeleton />
        <TableSkeleton columns={columns} rows={rows} />
      </PageLayout>
    </div>
  );
}
