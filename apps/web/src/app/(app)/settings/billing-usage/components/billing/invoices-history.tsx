'use client';

import { FileDollarIcon, Filter02Icon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  DataTable,
  type DataTableSettings,
  Input,
  NoData,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { invoicesHistory_subscription$key } from '@/__generated__/invoicesHistory_subscription.graphql';
import { tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { toInvoiceRow } from '../shared/invoice-row';
import { InvoicesFilterModal } from './invoices-filter-modal';
import { INVOICES_SKELETON_ROWS } from './invoices-table-layout';
import { useInvoicesTable } from './use-invoices-table';

/**
 * The tenant's Stripe history, every entry as the shared row reads it
 * (`invoice-row.ts`). `null` when the subscription answered without its
 * invoices — Stripe could not be reached — which is not the same as none.
 */
const invoicesHistoryFragment = graphql`
  fragment invoicesHistory_subscription on SubscriptionDetail {
    pendingInvoices {
      ...invoiceRow_invoice
    }
  }
`;

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order,
 * resized widths) kept in the browser under this table's own key.
 */
const INVOICES_TABLE_SETTINGS: DataTableSettings = { storageKey: 'billing-invoices' };

const INVOICES_UNAVAILABLE_MESSAGE =
  "Couldn't load the invoices. Try again in a moment, and contact support if this persists.";

/** `subscription` is `null` only while the page loads: the section draws itself with the table's skeleton rows. */
export function InvoicesHistory({ subscription }: { subscription: invoicesHistory_subscription$key | null }) {
  const data = useFragment(invoicesHistoryFragment, subscription);
  // The grid table, behind the app's one table flag; card rows while it is off. Until the flag is answered the table
  // is loading: one layout is never drawn and then replaced by the other.
  const tableGate = useTableGridGate();
  const pageLoading = useLoadingScope();
  const loading = pageLoading || data == null || tableGate === 'loading';
  const layout = tableLayoutFor(tableGate);
  const pendingInvoices = data?.pendingInvoices ?? null;
  // Memoized for the table instance, which keys its row model on the rows'
  // identity — the fragment's array is stable between store updates, the mapped
  // one would not be.
  const invoices = useMemo(() => (pendingInvoices ?? []).map(toInvoiceRow), [pendingInvoices]);
  const {
    table,
    search,
    setSearch,
    sortState,
    handleSortChange,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    statusOptions,
  } = useInvoicesTable(invoices, loading);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Said under the section's own title, so what failed is named — a page that
  // silently drops its invoices reads as a tenant that has none.
  if (!loading && pendingInvoices == null) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <h2 className="text-ods-text-primary text-h2">Invoices History</h2>
        <p className="text-ods-error text-h6">{INVOICES_UNAVAILABLE_MESSAGE}</p>
      </div>
    );
  }

  // Drawn for every workspace, a trial's included. No invoice at all is the app's empty state under the section's title,
  // as every other list without records says it: nothing to search, filter or sort, so no toolbar and no column titles.
  // In the section, not filling the page (`EmptyState`) — the page goes on above it.
  if (!loading && invoices.length === 0) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <h2 className="text-ods-text-primary text-h2">Invoices History</h2>
        <NoData
          icon={<FileDollarIcon />}
          title="No invoices yet"
          description="Invoices appear here once the workspace is billed."
          className="py-[var(--spacing-system-xxl)]"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 className="text-ods-text-primary text-h2">Invoices History</h2>

      {/* Below `md` the whole table header is gone (`hidden content-md:flex`), and the
          STATUS funnel with it — so the filter moves next to the search, the same
          toolbar shape the scripts and schedules tables use. */}
      <div className="flex items-center gap-[var(--spacing-system-m)]">
        <div className="flex-1">
          <Input
            userValue
            startAdornment={<SearchIcon />}
            placeholder="Search for Invoice"
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full"
          />
        </div>
        {/* The grid table keeps its header, with the funnel and the sort, at every width. */}
        {layout === 'cards' && (
          <Button
            variant="outline"
            size="icon"
            className="content-md:hidden"
            onClick={() => setMobileFilterOpen(true)}
            aria-label="Open filters"
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
          />
        )}
      </div>

      {/* A section of the billing page: the grid keeps its natural height and the page scrolls. Card rows do not read
          the settings. */}
      <DataTable table={table} layout={layout} settings={INVOICES_TABLE_SETTINGS}>
        {/* The grid's count sits above the table; the card header carries its own (`rightSlot`). */}
        {layout === 'grid' && (
          <DataTable.Meta>
            <DataTable.RowCount loading={loading} />
          </DataTable.Meta>
        )}
        <DataTable.Header
          rightSlot={<DataTable.RowCount loading={loading} />}
          sort={sortState}
          onSortChange={handleSortChange}
          loading={loading}
        />
        <DataTable.Body
          loading={loading}
          loadingCells={loading}
          skeletonRows={INVOICES_SKELETON_ROWS}
          emptyState={{ title: 'No invoices found', description: 'Try adjusting your search or filters.' }}
        />
      </DataTable>

      <InvoicesFilterModal
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        statusOptions={statusOptions}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
      />
    </div>
  );
}
