'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { TicketTableBody } from '@/app/(app)/tickets/components/ticket-table-columns';
import type { Dialog } from '@/app/(app)/tickets/types/dialog.types';
import { oneLineEmptyState } from '@/app/components/shared/empty-state';
import { useGridTableProps } from '@/app/hooks/use-table-layout';
import { ASSIGNED_ITEMS_SKELETON_ROWS } from '../use-assigned-items';

interface TicketsAssignedTableProps {
  tickets: Dialog[];
  isLoading?: boolean;
}

export function TicketsAssignedTable({ tickets, isLoading }: TicketsAssignedTableProps) {
  // The new grid table, behind the app's one table flag; card rows while it is off. The panel is a section of a
  // longer page, so the table keeps its natural height.
  const tableGrid = useGridTableProps('assignments-tickets');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter(t => {
      const title = (t.title ?? '').toLowerCase();
      const org = (t.organizationName ?? '').toLowerCase();
      return title.includes(needle) || org.includes(needle);
    });
  }, [tickets, debouncedSearch]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      <Input
        userValue
        placeholder="Search for Ticket"
        value={search}
        onChange={e => setSearch(e.target.value)}
        startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
      />
      <TicketTableBody
        tickets={filtered}
        // While the flag is read the table draws its loading rows: it never draws one layout and swaps.
        isLoading={isLoading || tableGrid.loading}
        layout={tableGrid.layout}
        settings={tableGrid.settings}
        emptyState={oneLineEmptyState('No tickets assigned.')}
        skeletonRows={ASSIGNED_ITEMS_SKELETON_ROWS}
      />
    </div>
  );
}
