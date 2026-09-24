'use client';

import { Filter02Icon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, DataTable, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { invoicesHistory_subscription$key } from '@/__generated__/invoicesHistory_subscription.graphql';
import { toInvoiceRow } from '../shared/invoice-row';
import { InvoicesFilterModal } from './invoices-filter-modal';
import { useInvoicesTable } from './use-invoices-table';

/** The tenant's Stripe history, every entry as the shared row reads it (`invoice-row.ts`). */
const invoicesHistoryFragment = graphql`
  fragment invoicesHistory_subscription on SubscriptionDetail {
    pendingInvoices {
      ...invoiceRow_invoice
    }
  }
`;

export function InvoicesHistory({ subscription }: { subscription: invoicesHistory_subscription$key }) {
  const data = useFragment(invoicesHistoryFragment, subscription);
  // Memoized for the table instance, which keys its row model on the rows'
  // identity — the fragment's array is stable between store updates, the mapped
  // one would not be.
  const invoices = useMemo(() => data.pendingInvoices.map(toInvoiceRow), [data.pendingInvoices]);
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
  } = useInvoicesTable(invoices);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  if (invoices.length === 0) return null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 className="text-ods-text-primary text-h2">Invoices History</h2>

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
