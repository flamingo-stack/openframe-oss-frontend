'use client';

import {
  ExternalLinkIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DataTableFilterOption,
  FilterModal,
  Input,
  type Row,
  type SortDirection,
  type SortingState,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { InvoiceStatus } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { formatCurrency, formatDateOrDash } from '../lib/format';
import { INVOICE_COLUMNS } from '../lib/invoices-table-columns';

interface InvoiceItem {
  id: string;
  /** Human-readable Stripe invoice number (e.g. "ABCD-0001"). Null for legacy entries. */
  invoiceNumber?: string | null;
  /**
   * Lifecycle status mirrored from Stripe. Typed loosely (not `InvoiceStatus`) so
   * the relay-generated shape — which widens with `"%future added value"` — assigns
   * cleanly; `statusTag` narrows it against the `InvoiceStatus` values.
   */
  status?: string | null;
  // Major currency units (e.g. 11.92 USD). No `currency` beside it: `formatCurrency`
  // prints USD, so carrying the code without reading it only looked like support
  // for others. Re-select the field when a non-USD tenant is real.
  amountDue: number;
  createdAt: string;
  dueDate?: string | null;
  hostedInvoiceUrl: string;
}

/** Amount in major units (dollars) — the backend already returns `amountDue` in major units. */
function invoiceAmount(invoice: InvoiceItem): number {
  return invoice.amountDue;
}

interface StatusTag {
  variant: 'success' | 'warning' | 'error' | 'grey';
  label: string;
}

/** Legacy rows carry no status at all; Stripe only ever owed us money for them. */
const UNPAID: StatusTag = { variant: 'warning', label: 'Unpaid' };

/**
 * Tag styling + label per lifecycle status, exhaustive over `InvoiceStatus` on
 * purpose: a status Stripe adds later breaks the build here instead of being
 * quietly billed to the customer as "Unpaid".
 *
 * OPEN is spelled out rather than left to the fallback — it is the one status
 * that genuinely means unpaid, and conflating it with "unknown" is what hid the
 * distinction before.
 *
 * VOID reads "Canceled": `void` is Stripe's own word for an invoice withdrawn
 * before it was ever paid, and the only way a customer's invoice gets there is a
 * cancellation. Every other surface in the product calls that canceled, so the
 * wire value stays VOID and only the label is in the customer's vocabulary.
 */
const INVOICE_STATUS_TAGS = {
  [InvoiceStatus.DRAFT]: { variant: 'grey', label: 'Draft' },
  [InvoiceStatus.OPEN]: UNPAID,
  [InvoiceStatus.PAID]: { variant: 'success', label: 'Paid' },
  [InvoiceStatus.VOID]: { variant: 'error', label: 'Canceled' },
  [InvoiceStatus.UNCOLLECTIBLE]: { variant: 'error', label: 'Uncollectible' },
} satisfies Record<InvoiceStatus, StatusTag>;

/** Tag styling + label for a lifecycle status; null (legacy) reads as unpaid. */
function statusTag(status: string | null | undefined): StatusTag {
  return presentationFor(INVOICE_STATUS_TAGS, status) ?? UNPAID;
}

/**
 * The status column is keyed by its LABEL, not by the wire status.
 *
 * Two wire values can print the same tag — a legacy `null` row and an `OPEN` one
 * are both "Unpaid" — and a filter listing "Unpaid" twice, each hiding rows the
 * other shows, is a filter nobody can use. Keying on what the row displays makes
 * the option list exactly the set of tags on screen.
 */
function statusKey(invoice: InvoiceItem): string {
  return statusTag(invoice.status).label;
}

/**
 * Epoch ms for sorting, or `undefined` for a date that is missing or unparseable.
 *
 * `undefined` and not `null` because that is the only absence TanStack knows:
 * paired with `sortUndefined: 'last'` it settles those rows BEFORE the descending
 * flip is applied, so they stay at the bottom in both directions. A comparator
 * returning them last would only hold for ascending — one click later, the rows
 * with no answer to "which is due soonest" would be the ones on top.
 *
 * The column sorts on this number rather than on the ISO string, so a row whose
 * date the backend sends in another shape sorts as unknown instead of
 * lexicographically among the others.
 */
function dateSortValue(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : undefined;
}

export function InvoicesHistory({ invoices }: { invoices: readonly InvoiceItem[] }) {
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const data = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return invoices as InvoiceItem[];
    // Client-side match on invoice number and amount. The amount haystack holds
    // both the bare "11.92" and the formatted "$11.92" so "11.9", "11.92" and
    // "$11.92" all match.
    return invoices.filter(invoice => {
      const amount = invoiceAmount(invoice);
      const haystack = [invoice.invoiceNumber ?? '', amount.toFixed(2), formatCurrency(amount)].join(' ').toLowerCase();
      return haystack.includes(query);
    }) as InvoiceItem[];
  }, [invoices, search]);

  // Built from the statuses actually present, not from the enum: an option that
  // can only ever return an empty table is a dead end the user has to undo.
  // Derived from the FULL list rather than from `data`, so typing in the search
  // box does not silently retire the filter option the user has selected.
  const statusOptions = useMemo<DataTableFilterOption[]>(() => {
    const labels = new Set(invoices.map(statusKey));
    return [...labels].sort().map(label => ({ id: label, label, value: label }));
  }, [invoices]);

  const columns = useMemo<ColumnDef<InvoiceItem>[]>(
    () => [
      {
        // Human-readable Stripe invoice number over the date it was issued.
        // Legacy entries not yet reconciled have no number, and the issue date
        // used to stand in alone — a date under a header reading INVOICE is not a
        // missing identifier, it is a wrong one. An em dash says what is true:
        // this row has no number. The date keeps its place underneath either way.
        accessorKey: 'invoiceNumber',
        header: 'INVOICE',
        cell: ({ row }: { row: Row<InvoiceItem> }) => (
          <>
            <TruncateText>{row.original.invoiceNumber ?? '—'}</TruncateText>
            <span className="truncate text-h6 text-ods-text-secondary">{formatDateOrDash(row.original.createdAt)}</span>
          </>
        ),
        enableSorting: false,
        meta: liveColumnMeta(INVOICE_COLUMNS.invoiceNumber),
      },
      {
        id: 'dueDate',
        accessorFn: (row: InvoiceItem) => dateSortValue(row.dueDate),
        header: 'DUE DATE',
        cell: ({ row }: { row: Row<InvoiceItem> }) => (
          <TruncateText>{formatDateOrDash(row.original.dueDate)}</TruncateText>
        ),
        sortUndefined: 'last',
        meta: liveColumnMeta(INVOICE_COLUMNS.dueDate),
      },
      {
        accessorKey: 'amountDue',
        header: 'AMOUNT',
        cell: ({ row }: { row: Row<InvoiceItem> }) => (
          <TruncateText>{formatCurrency(invoiceAmount(row.original))}</TruncateText>
        ),
        meta: liveColumnMeta(INVOICE_COLUMNS.amountDue),
      },
      {
        id: 'status',
        accessorFn: statusKey,
        header: 'STATUS',
        cell: ({ row }: { row: Row<InvoiceItem> }) => {
          const { variant, label } = statusTag(row.original.status);
          return <Tag variant={variant} label={label} />;
        },
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        // The body cell is a `flex-col` (default `align-items: stretch`), which stretches the
        // tag full-width. `items-start` keeps it at its natural width, left-aligned.
        meta: liveColumnMeta(INVOICE_COLUMNS.status, {
          cellClassName: 'items-start',
          filter: { options: statusOptions },
        }),
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<InvoiceItem> }) => (
          <div data-no-row-click className="flex justify-end pointer-events-auto">
            <a
              href={row.original.hostedInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open invoice"
              className="flex items-center justify-center p-3 bg-ods-card border border-ods-border rounded-md text-ods-text-secondary hover:text-ods-text-primary transition-colors"
            >
              <ExternalLinkIcon className="size-6" />
            </a>
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(INVOICE_COLUMNS.actions),
      },
    ],
    [statusOptions],
  );

  const getRowId = useCallback((row: InvoiceItem) => row.id, []);

  const table = useDataTable<InvoiceItem>({
    data,
    columns,
    getRowId,
    clientSideSorting: true,
    clientSideFiltering: true,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  // The header owns only the indicator; the cycle is ours. Third click clears the
  // sort rather than pinning one of the two directions — the list's natural order
  // is Stripe's own, and there is no way back to it otherwise.
  const handleSortChange = useCallback((columnId: string) => {
    setSorting(prev => {
      const current = prev[0];
      if (!current || current.id !== columnId) return [{ id: columnId, desc: false }];
      if (!current.desc) return [{ id: columnId, desc: true }];
      return [];
    });
  }, []);

  const sortState = sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;

  /**
   * The same two sortable columns, for the mobile modal — below `md` the table
   * header is gone entirely (`hidden md:flex`), so its arrows are unreachable
   * and this is the only place left to reorder from.
   *
   * Labels are written out rather than taken from `INVOICE_COLUMNS[*].header`:
   * those are the table's uppercase mono headings, and `SortColumnItem` renders
   * its label as plain `text-h4` body text.
   *
   * Unlike the filters, a sort here applies IMMEDIATELY rather than on Apply —
   * `FilterModal` drafts only what it can commit in `handleApply`, and sort is
   * not among them. The arrow updates live, so the modal still shows the truth.
   */
  const sortConfig = useMemo(
    () => ({
      columns: [
        { key: 'dueDate', label: 'Due Date' },
        { key: 'amountDue', label: 'Amount' },
      ],
      sortBy: sorting[0]?.id,
      sortDirection: sorting[0] ? ((sorting[0].desc ? 'desc' : 'asc') as SortDirection) : undefined,
    }),
    [sorting],
  );

  // `SortColumnItem` owns the none → asc → desc → clear cycle and hands us the
  // outcome, so these two only have to store it — the header's `handleSortChange`
  // runs the same cycle itself because there it is a single click target.
  const handleModalSort = useCallback((columnId: string, direction: SortDirection) => {
    setSorting([{ id: columnId, desc: direction === 'desc' }]);
  }, []);

  const handleModalSortClear = useCallback(() => setSorting([]), []);

  /**
   * The one filter this table has, restated for the mobile modal.
   *
   * Same `statusOptions` the column header's funnel uses, so the two controls
   * can never offer different statuses — they are the same list, reached from
   * two widths. `FilterModalOption` wants `{ id, label }` and
   * `DataTableFilterOption` carries a third field it ignores.
   */
  const filterGroups = useMemo(() => [{ id: 'status', title: 'Status', options: statusOptions }], [statusOptions]);

  /** TanStack's filter state in the modal's shape: column id → selected option ids. */
  const mobileFilters = useMemo(
    () =>
      Object.fromEntries(
        columnFilters.map(filter => [filter.id, Array.isArray(filter.value) ? (filter.value as string[]) : []]),
      ),
    [columnFilters],
  );

  /**
   * And back again on Apply. Empty selections are dropped rather than stored as
   * empty arrays: `multiSelectFilterFn` treats an empty array as "no filter"
   * anyway, and a table whose `columnFilters` is never empty reports itself as
   * filtered forever — which is what the empty state reads to decide between
   * "nothing matched" and "nothing here yet".
   */
  const handleMobileFilterChange = useCallback((filters: Record<string, string[]>) => {
    setColumnFilters(
      Object.entries(filters)
        .filter(([, values]) => values.length > 0)
        .map(([id, values]) => ({ id, value: values })),
    );
  }, []);

  if (invoices.length === 0) return null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 className="text-h2 text-ods-text-primary">Invoices History</h2>

      {/* Below `md` the whole table header is gone (`hidden md:flex`), and the
          STATUS funnel with it — so the filter moves next to the search, the same
          toolbar shape the scripts and schedules tables use. */}
      <div className="flex items-center gap-[var(--spacing-system-m)]">
        <div className="flex-1">
          <Input
            startAdornment={<SearchIcon />}
            placeholder="Search for Invoice"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileFilterOpen(true)}
          aria-label="Open filters"
          leftIcon={<Filter02Icon className="text-ods-text-primary" />}
        />
      </div>

      <DataTable table={table}>
        <DataTable.Header rightSlot={<DataTable.RowCount />} sort={sortState} onSortChange={handleSortChange} />
        <DataTable.Body
          emptyState={{ title: 'No invoices found', description: 'Try adjusting your search or filters.' }}
        />
      </DataTable>

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        filterGroups={filterGroups}
        currentFilters={mobileFilters}
        onFilterChange={handleMobileFilterChange}
        sortConfig={sortConfig}
        onSort={handleModalSort}
        onSortClear={handleModalSortClear}
      />
    </div>
  );
}
