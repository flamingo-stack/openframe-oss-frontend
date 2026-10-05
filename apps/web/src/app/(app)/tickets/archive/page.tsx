'use client';

import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { ArchivedTickets } from '../components/tickets-table';
import type { TicketListSort } from '../services/ticket-service.types';
import { parseTicketListSort, ticketListSortToParams } from '../utils/ticket-list-sort';

export default function TicketsArchive() {
  const router = useRouter();
  const handleBack = useSafeBack(routes.tickets.list);
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    tagIds: { type: 'array', default: [] },
    // Same TICKET-header sort as the live list (see `tickets-view.tsx`).
    sortDir: { type: 'string', default: '' },
  });
  const { search, setSearch } = useSearchParam(params.search, value => setParam('search', value), 300);
  const handleTagIdsChange = useCallback((ids: string[]) => setParam('tagIds', ids), [setParam]);
  const sort = parseTicketListSort(params.sortDir);
  const handleSortChange = (next: TicketListSort) => setParams(ticketListSortToParams(next));

  useEffect(() => {
    if (!isSaasTenantMode()) {
      router.replace(routes.dashboard);
      return;
    }
  }, [router]);

  if (!isSaasTenantMode()) {
    return null;
  }

  return (
    <ArchivedTickets
      backButton={{ label: 'Back', onClick: handleBack }}
      search={search}
      onSearchChange={setSearch}
      tagIds={params.tagIds}
      onTagIdsChange={handleTagIdsChange}
      sort={sort}
      onSortChange={handleSortChange}
    />
  );
}
