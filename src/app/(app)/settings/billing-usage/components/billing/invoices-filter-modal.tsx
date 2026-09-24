'use client';

import {
  type ColumnFiltersState,
  type DataTableFilterOption,
  FilterModal,
  type SortDirection,
  type SortingState,
} from '@flamingo-stack/openframe-frontend-core/components/ui';

interface InvoicesFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The same options the column header's funnel offers (`invoiceStatusOptions`). */
  statusOptions: DataTableFilterOption[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: (filters: ColumnFiltersState) => void;
}

/**
 * The table's sort and its one filter, restated for the widths where the header
 * is gone entirely (`hidden md:flex`) and its arrows and funnel are unreachable.
 * This is the translation between TanStack's state and `FilterModal`'s shape,
 * in both directions — the state itself stays in `useInvoicesTable`, so the two
 * sets of controls can never disagree.
 *
 * Unlike the filters, a sort here applies IMMEDIATELY rather than on Apply —
 * `FilterModal` drafts only what it can commit in `handleApply`, and sort is
 * not among them. The arrow updates live, so the modal still shows the truth.
 */
export function InvoicesFilterModal({
  isOpen,
  onClose,
  statusOptions,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
}: InvoicesFilterModalProps) {
  /**
   * The same two sortable columns as the header. Labels are written out rather
   * than taken from the layout's headers: those are the table's uppercase mono
   * headings, and `SortColumnItem` renders its label as plain `text-h4` body
   * text.
   */
  const sortConfig = {
    columns: [
      { key: 'dueDate', label: 'Due Date' },
      { key: 'amountDue', label: 'Amount' },
    ],
    sortBy: sorting[0]?.id,
    sortDirection: sorting[0] ? ((sorting[0].desc ? 'desc' : 'asc') as SortDirection) : undefined,
  };

  /**
   * `FilterModalOption` wants `{ id, label }` and `DataTableFilterOption`
   * carries a third field it ignores — the same list, reached from two widths.
   */
  const filterGroups = [{ id: 'status', title: 'Status', options: statusOptions }];

  /** TanStack's filter state in the modal's shape: column id → selected option ids. */
  const currentFilters = Object.fromEntries(
    columnFilters.map(filter => [filter.id, Array.isArray(filter.value) ? (filter.value as string[]) : []]),
  );

  /**
   * And back again on Apply. Empty selections are dropped rather than stored as
   * empty arrays: `multiSelectFilterFn` treats an empty array as "no filter"
   * anyway, and a table whose `columnFilters` is never empty reports itself as
   * filtered forever — which is what the empty state reads to decide between
   * "nothing matched" and "nothing here yet".
   */
  const handleFilterChange = (filters: Record<string, string[]>) => {
    onColumnFiltersChange(
      Object.entries(filters)
        .filter(([, values]) => values.length > 0)
        .map(([id, values]) => ({ id, value: values })),
    );
  };

  return (
    <FilterModal
      isOpen={isOpen}
      onClose={onClose}
      filterGroups={filterGroups}
      currentFilters={currentFilters}
      onFilterChange={handleFilterChange}
      sortConfig={sortConfig}
      // `SortColumnItem` owns the none → asc → desc → clear cycle and hands us
      // the outcome, so these two only have to store it.
      onSort={(columnId, direction) => onSortingChange([{ id: columnId, desc: direction === 'desc' }])}
      onSortClear={() => onSortingChange([])}
    />
  );
}
