'use client';

import {
  type ColumnFiltersState,
  type SortingState,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/format-currency';
import type { InvoiceRow } from '../shared/invoice-row';
import { invoiceColumns, invoiceStatusOptions } from './invoices-table-columns';

/**
 * Client-side match on invoice number and amount. The amount haystack holds
 * both the bare "11.92" and the formatted "$11.92" so "11.9", "11.92" and
 * "$11.92" all match.
 */
function matchesSearch(invoice: InvoiceRow, query: string): boolean {
  const haystack = [invoice.invoiceNumber ?? '', invoice.amountDue.toFixed(2), formatCurrency(invoice.amountDue)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * The Invoices History table's state — search, sort, the status filter — and
 * the TanStack instance built over it. The component that renders it decides
 * only where the controls go; the mobile filter modal edits the same state from
 * a second set of controls.
 *
 * The rows, columns and row id are memoized because the instance memoizes its
 * row model on their identity — not for render performance, which the compiler
 * covers.
 */
export function useInvoicesTable(invoices: readonly InvoiceRow[]) {
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const data = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter(invoice => !query || matchesSearch(invoice, query));
  }, [invoices, search]);
  const statusOptions = useMemo(() => invoiceStatusOptions(invoices), [invoices]);
  const columns = useMemo(() => invoiceColumns(statusOptions), [statusOptions]);
  const getRowId = useCallback((row: InvoiceRow) => row.id, []);

  const table = useDataTable<InvoiceRow>({
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
  const handleSortChange = (columnId: string) => {
    setSorting(prev => {
      const current = prev[0];
      if (!current || current.id !== columnId) return [{ id: columnId, desc: false }];
      if (!current.desc) return [{ id: columnId, desc: true }];
      return [];
    });
  };

  const sortState = sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;

  return {
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
  };
}
