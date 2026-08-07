'use client';

import { ExternalLinkIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  Input,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { InvoiceStatus } from '@/generated/schema-enums';
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

/** Tag styling + label for each lifecycle status; null (legacy) reads as unpaid. */
function statusTag(status: string | null | undefined): {
  variant: 'success' | 'warning' | 'error' | 'grey';
  label: string;
} {
  switch (status) {
    case InvoiceStatus.PAID:
      return { variant: 'success', label: 'Paid' };
    case InvoiceStatus.DRAFT:
      return { variant: 'grey', label: 'Draft' };
    case InvoiceStatus.VOID:
      return { variant: 'error', label: 'Void' };
    case InvoiceStatus.UNCOLLECTIBLE:
      return { variant: 'error', label: 'Uncollectible' };
    default:
      // OPEN and legacy (null) both mean "still owed".
      return { variant: 'warning', label: 'Unpaid' };
  }
}

export function InvoicesHistory({ invoices }: { invoices: readonly InvoiceItem[] }) {
  const [search, setSearch] = useState('');

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

  const columns = useMemo<ColumnDef<InvoiceItem>[]>(
    () => [
      {
        // Human-readable Stripe invoice number. Legacy entries not yet reconciled
        // have none, and the issue date used to stand in — a date under a header
        // reading INVOICE is not a missing identifier, it is a wrong one. An em
        // dash says what is true: this row has no number.
        accessorKey: 'invoiceNumber',
        header: 'INVOICE',
        cell: ({ row }: { row: Row<InvoiceItem> }) => <TruncateText>{row.original.invoiceNumber ?? '—'}</TruncateText>,
        meta: liveColumnMeta(INVOICE_COLUMNS.invoiceNumber),
      },
      {
        accessorKey: 'dueDate',
        header: 'DUE DATE',
        cell: ({ row }: { row: Row<InvoiceItem> }) => (
          <TruncateText>{formatDateOrDash(row.original.dueDate)}</TruncateText>
        ),
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
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }: { row: Row<InvoiceItem> }) => {
          const { variant, label } = statusTag(row.original.status);
          return <Tag variant={variant} label={label} />;
        },
        enableSorting: false,
        // The body cell is a `flex-col` (default `align-items: stretch`), which stretches the
        // tag full-width. `items-start` keeps it at its natural width, left-aligned.
        meta: liveColumnMeta(INVOICE_COLUMNS.status, { cellClassName: 'items-start' }),
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
    [],
  );

  const getRowId = useCallback((row: InvoiceItem) => row.id, []);

  const table = useDataTable<InvoiceItem>({ data, columns, getRowId });

  if (invoices.length === 0) return null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 className="text-h2 text-ods-text-primary">Invoices History</h2>

      <Input
        startAdornment={<SearchIcon />}
        placeholder="Search for Invoice"
        value={search}
        onChange={event => setSearch(event.target.value)}
        className="w-full"
      />

      <DataTable table={table}>
        <DataTable.Header rightSlot={<DataTable.RowCount />} />
        <DataTable.Body emptyState={{ title: 'No invoices found', description: 'Try adjusting your search.' }} />
      </DataTable>
    </div>
  );
}
