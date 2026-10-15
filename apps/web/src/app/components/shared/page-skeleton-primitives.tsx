'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  type ColumnDef,
  DataTable,
  type PageActionButton,
  PageLayout,
  type PageLayoutProps,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
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
  /**
   * Set when the live table pins its header under a sticky toolbar — the
   * skeleton pins at the same offset, so the header does not jump on load.
   */
  stickyHeaderOffset?: string;
  /** What the screen reader hears while the table loads. */
  label?: string;
  /** `false` inside another loading region, which announces for the table too. Default `true`. */
  region?: boolean;
}

/**
 * Empty `DataTable` in its loading state, shaped by `columns`. Pass the same
 * headers/widths the real table declares so the header row is pixel-identical.
 *
 * The `LoadingRegion` around it is the table's one announcement (the rows'
 * own region is turned off, `loadingRegion={false}`). `DataTable` takes only
 * `table`/`children`/`className`, so the region needs its own element. It
 * wraps a single child, so the flex-item count of the parent is unchanged.
 */
export function TableSkeleton({
  columns,
  rows = 10,
  stickyHeaderOffset,
  label = 'Loading table',
  region = true,
}: TableSkeletonProps) {
  const columnDefs = useMemo<ColumnDef<unknown>[]>(() => skeletonColumnDefs<unknown>(columns), [columns]);

  const table = useDataTable<unknown>({
    data: EMPTY_SKELETON_ROWS,
    columns: columnDefs,
    getRowId: () => '',
    enableSorting: false,
  });

  return (
    <LoadingRegion label={label} announce={region}>
      <DataTable table={table}>
        <DataTable.Header stickyHeader={stickyHeaderOffset !== undefined} stickyHeaderOffset={stickyHeaderOffset} />
        <DataTable.Body loading loadingRegion={false} skeletonRows={rows} emptyMessage="" rowClassName="mb-1" />
      </DataTable>
    </LoadingRegion>
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
    <div className={cn('relative h-14 w-full border-b border-ods-border', className)}>
      <div className="flex h-full items-center gap-1 overflow-hidden">
        {widths.map((width, index) => (
          <div key={index} className={cn('flex h-14 shrink-0 items-center justify-center gap-2 p-4', width)}>
            <UnifiedSkeleton className="h-6 w-6 shrink-0" />
            <UnifiedSkeleton className="h-5 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The search/filter toolbar row list pages render above their table. */
function SearchBarSkeleton() {
  return <UnifiedSkeleton className="h-12 w-full rounded-md" />;
}

export interface ListPageSkeletonProps {
  /** Real page title — static text, so it renders as-is instead of a bar. */
  title: string;
  /** The page's Back link, when it has one — its row is part of the header height. */
  backButton?: PageLayoutProps['backButton'];
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
export function ListPageSkeleton({ title, backButton, actions, tabWidths, columns, rows }: ListPageSkeletonProps) {
  return (
    <LoadingRegion label={`Loading ${title.toLowerCase()}`} className="flex w-full flex-col">
      {tabWidths && (
        <div className="px-[var(--spacing-system-l)]">
          <TabBarSkeleton widths={tabWidths} />
        </div>
      )}
      <PageLayout
        title={title}
        backButton={backButton}
        actions={actions}
        actionsVariant="icon-buttons"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        contentClassName="flex flex-col"
      >
        <SearchBarSkeleton />
        <TableSkeleton columns={columns} rows={rows} region={false} />
      </PageLayout>
    </LoadingRegion>
  );
}
