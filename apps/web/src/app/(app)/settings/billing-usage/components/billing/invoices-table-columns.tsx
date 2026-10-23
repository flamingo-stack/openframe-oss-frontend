import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type DataTableFilterOption,
  type Row,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { ValueText } from '@/app/components/shared/value-text';
import { InvoiceStatus } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { multiSelectFilterFn } from '@/lib/table-filters';
import type { InvoiceRow } from '../shared/invoice-row';
import { INVOICE_COLUMNS } from './invoices-table-layout';

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
function statusKey(invoice: InvoiceRow): string {
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

/**
 * The status filter's options, built from the statuses actually present rather
 * than from the enum: an option that can only ever return an empty table is a
 * dead end the user has to undo. Built from the FULL list, not the searched
 * one, so typing in the search box does not silently retire the option the
 * user has selected.
 */
export function invoiceStatusOptions(invoices: readonly InvoiceRow[]): DataTableFilterOption[] {
  const labels = new Set(invoices.map(statusKey));
  return [...labels].sort().map(label => ({ id: label, label, value: label }));
}

/**
 * A date of the row in its cell's type. While the table draws its loading rows (a loading scope, every field absent)
 * it is a bar of that line.
 */
function InvoiceDate({ iso, variant, tone }: { iso: string | null | undefined; variant?: 'h6'; tone?: 'secondary' }) {
  if (useLoadingScope()) return <TextLineSkeleton type={variant ?? 'h4'} className="w-3/4" />;
  return (
    <TruncateText variant={variant} tone={tone}>
      {formatDate(iso)}
    </TruncateText>
  );
}

/** The amount owed; a bar of its line while the row is read (a placeholder row has no amount to format). */
function InvoiceAmount({ amount }: { amount: number }) {
  if (useLoadingScope()) return <TextLineSkeleton type="h4" className="w-3/4" />;
  return <TruncateText>{formatCurrency(amount)}</TruncateText>;
}

/** The lifecycle tag; the tag's own skeleton while the row is read (a placeholder row has no status, not "Unpaid"). */
function InvoiceStatusTag({ status }: { status: string | null | undefined }) {
  const loading = useLoadingScope();
  const { variant, label } = statusTag(status);
  return <Tag variant={variant} label={label} loading={loading} />;
}

/** The table's columns; the status column filters over `statusOptions`. */
export function invoiceColumns(statusOptions: DataTableFilterOption[]): ColumnDef<InvoiceRow>[] {
  return [
    {
      // Human-readable Stripe invoice number over the date it was issued.
      // Legacy entries not yet reconciled have no number, and the issue date
      // used to stand in alone — a date under a header reading INVOICE is not a
      // missing identifier, it is a wrong one. An em dash says what is true:
      // this row has no number. The date keeps its place underneath either way.
      accessorKey: 'invoiceNumber',
      header: 'INVOICE',
      cell: ({ row }: { row: Row<InvoiceRow> }) => (
        <>
          <ValueText value={row.original.invoiceNumber} />
          <InvoiceDate iso={row.original.createdAt} variant="h6" tone="secondary" />
        </>
      ),
      enableSorting: false,
      meta: liveColumnMeta(INVOICE_COLUMNS.invoiceNumber),
    },
    {
      id: 'dueDate',
      accessorFn: (row: InvoiceRow) => dateSortValue(row.dueDate),
      header: 'DUE DATE',
      cell: ({ row }: { row: Row<InvoiceRow> }) => <InvoiceDate iso={row.original.dueDate} />,
      sortUndefined: 'last',
      meta: liveColumnMeta(INVOICE_COLUMNS.dueDate),
    },
    {
      // `amountDue` is already in major units (dollars): the backend converts
      // from Stripe's cents.
      accessorKey: 'amountDue',
      header: 'AMOUNT',
      cell: ({ row }: { row: Row<InvoiceRow> }) => <InvoiceAmount amount={row.original.amountDue} />,
      meta: liveColumnMeta(INVOICE_COLUMNS.amountDue),
    },
    {
      id: 'status',
      accessorFn: statusKey,
      header: 'STATUS',
      cell: ({ row }: { row: Row<InvoiceRow> }) => <InvoiceStatusTag status={row.original.status} />,
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
      cell: ({ row }: { row: Row<InvoiceRow> }) => (
        <div data-no-row-click className="pointer-events-auto flex justify-end">
          {/* No link before Stripe finalizes the invoice (nor on a loading row): the control stays, disabled, so the
              column keeps its shape. */}
          {row.original.hostedInvoiceUrl ? (
            <a
              href={row.original.hostedInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open invoice"
              className="flex items-center justify-center rounded-md border border-ods-border bg-ods-card p-3 text-ods-text-secondary transition-colors hover:text-ods-text-primary"
            >
              <ExternalLinkIcon className="size-6" />
            </a>
          ) : (
            <Button variant="outline" size="icon" disabled aria-label="This invoice has no payment link yet">
              <ExternalLinkIcon className="size-6" />
            </Button>
          )}
        </div>
      ),
      enableSorting: false,
      meta: liveColumnMeta(INVOICE_COLUMNS.actions),
    },
  ];
}
