'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ColumnDef, DataTable, Input, useDataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { skeletonColumnDefs, type TableSkeletonColumn } from '@/app/components/shared';
import { DEVICE_TAB_SKELETON_ROWS } from './device-tab-columns';

/**
 * The REAL search input — fixed chrome, so we render the actual core `Input` (enabled, icon +
 * placeholder) during load instead of a grey bar, matching the tab's live search field.
 */
export function SearchInputSkeleton({ placeholder }: { placeholder: string }) {
  return (
    <Input
      placeholder={placeholder}
      className="w-full"
      startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
    />
  );
}

const EMPTY_TABLE_ROWS: unknown[] = [];

/**
 * Standard table-tab skeleton — the app-wide loading pattern (see `customer-details-skeleton`):
 * a search bar + an empty real `DataTable` with `loading`, which renders the real
 * `DataTableSkeleton` (all columns, correct header height, responsive condensing). Headers are
 * rendered for real; the search input is a plain bar (not a disabled input).
 *
 * Beside the tabs rather than in `device-details-skeleton.tsx`: a tab draws it too, for the
 * window before the flag it switches on has answered (`software-tab.tsx`), and the page
 * skeleton imports the tabs — so it cannot be where they would have to import it from.
 */
export function TableTabSkeleton({
  columns,
  placeholder,
}: {
  columns: readonly TableSkeletonColumn[];
  placeholder: string;
}) {
  const colDefs = useMemo<ColumnDef<unknown>[]>(() => skeletonColumnDefs<unknown>(columns), [columns]);

  const table = useDataTable<unknown>({
    data: EMPTY_TABLE_ROWS,
    columns: colDefs,
    getRowId: () => '',
    enableSorting: false,
  });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <SearchInputSkeleton placeholder={placeholder} />
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body loading skeletonRows={DEVICE_TAB_SKELETON_ROWS} emptyMessage="" rowClassName="mb-1" />
      </DataTable>
    </div>
  );
}
