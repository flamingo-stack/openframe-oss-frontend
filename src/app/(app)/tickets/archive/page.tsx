'use client';

import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { isSaasTenantMode } from '@/lib/app-mode';
import { fromCsvParam, toCsvParam } from '@/lib/csv-search-param';
import { routes } from '@/lib/routes';
import { ArchivedTickets } from '../components/tickets-table';

export default function TicketsArchive() {
  const router = useRouter();
  const handleBack = useSafeBack(routes.tickets.list);
  const { params, setParam } = useApiParams({
    search: { type: 'string', default: '' },
    // One comma-separated param — the gateway 502s URLs with a repeated query key.
    tagIds: { type: 'string', default: '' },
  });
  const { search, setSearch } = useSearchParam(params.search, value => setParam('search', value), 300);
  const tagIds = useMemo(() => fromCsvParam(params.tagIds), [params.tagIds]);
  const handleTagIdsChange = useCallback((ids: string[]) => setParam('tagIds', toCsvParam(ids)), [setParam]);

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
      tagIds={tagIds}
      onTagIdsChange={handleTagIdsChange}
    />
  );
}
