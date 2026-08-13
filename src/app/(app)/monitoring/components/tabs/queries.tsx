'use client';

import {
  BracketCurlyEllipsisVrIcon,
  DatabaseIcon,
  HourglassClockIcon,
  PlusCircleIcon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { DataTable, Input, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  EmptyState,
  formatQueryInterval,
  onboardingGuideButton,
  QueriesTable,
  type QueryTableRow,
  SectionLoadError,
} from '@/app/components/shared';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { ConfirmDeleteMonitoringModal } from '../../components/confirm-delete-monitoring-modal';
import { useQueries } from '../../hooks/use-queries';
import type { Query } from '../../types/queries.types';

const PAGE_SIZE = 20;

// One literal for both the strip above the table and the table's own empty
// slot — they say the same thing and must not drift apart.
const LOAD_ERROR_MESSAGE = "Couldn't load queries.";

export function Queries() {
  const router = useRouter();

  const { params, setParams } = useApiParams({
    search: { type: 'string', default: '' },
  });

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Local search keeps typing responsive; the shared hook debounces the write to
  // the URL param so we don't navigate the router (and re-filter) on every keystroke.
  const { search, setSearch, debouncedSearch } = useSearchParam(
    params.search,
    value => setParams({ search: value }),
    300,
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setVisibleCount(PAGE_SIZE);
    },
    [setSearch],
  );

  const { queries, isLoading, isOffline, canClaimEmpty, error, refetch, deleteQuery } = useQueries();
  const [queryToDelete, setQueryToDelete] = useState<Query | null>(null);

  const filteredQueries = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.trim() === '') return queries;

    const searchLower = debouncedSearch.toLowerCase().trim();
    return queries.filter(
      query => query.name.toLowerCase().includes(searchLower) || query.description.toLowerCase().includes(searchLower),
    );
  }, [queries, debouncedSearch]);

  const visibleQueries = useMemo(() => filteredQueries.slice(0, visibleCount), [filteredQueries, visibleCount]);

  const rowActions = useCallback(
    (query: Query) => [
      {
        label: 'Query Details',
        onClick: () => router.push(routes.monitoring.query(query.id)),
      },
      {
        label: 'Delete Query',
        onClick: () => setQueryToDelete(query),
      },
    ],
    [router],
  );

  // Map the fleet-wide Query model into the shared table's normalized view-model.
  const rows = useMemo<QueryTableRow[]>(
    () =>
      visibleQueries.map(query => ({
        id: String(query.id),
        name: query.name,
        description: query.description,
        frequencyLabel: formatQueryInterval(query.interval),
        actions: rowActions(query),
        href: routes.monitoring.query(query.id),
      })),
    [visibleQueries, rowActions],
  );

  const handleLoadMore = useCallback(() => setVisibleCount(prev => prev + PAGE_SIZE), []);

  const handleAddQuery = useCallback(() => {
    router.push(routes.monitoring.queryNew);
  }, [router]);

  // `canClaimEmpty` is the shared precondition (see `lib/query-state.ts`): data
  // arrived and nothing is obscuring it. Without it a failed or offline load —
  // both of which leave the list at length zero — renders "no queries yet"
  // underneath the error strip.
  const showEmptyState = canClaimEmpty && !debouncedSearch.trim() && queries.length === 0;

  const actions = useMemo(
    () => [
      {
        label: 'Add Query',
        variant: (showEmptyState ? 'accent' : 'outline') as 'accent' | 'outline',
        icon: (
          <PlusCircleIcon
            size={24}
            className={showEmptyState ? 'text-ods-text-on-accent' : 'text-ods-text-secondary'}
          />
        ),
        onClick: handleAddQuery,
      },
    ],
    [handleAddQuery, showEmptyState],
  );

  return (
    <PageLayout title="Queries" actions={actions} className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      {(error || isOffline) && <SectionLoadError {...loadErrorProps(isOffline, LOAD_ERROR_MESSAGE, () => refetch())} />}
      {showEmptyState ? (
        <EmptyState
          icon={<BracketCurlyEllipsisVrIcon />}
          title="No queries yet"
          description="Real-time questions you ask across your fleet (which devices have Chrome installed, who is on an outdated OS, which machines are low on disk) will be displayed here."
          actions={[
            { icon: <SearchIcon />, label: 'Get answers across all devices in seconds' },
            { icon: <DatabaseIcon />, label: 'Use SQL-like syntax or natural language via Mingo' },
            { icon: <HourglassClockIcon />, label: 'Save queries to rerun later or schedule them' },
          ]}
          {...onboardingGuideButton('queries', 'Learn more about Queries')}
        />
      ) : (
        <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 bg-ods-bg py-[var(--spacing-system-l)] -my-[var(--spacing-system-l)]"
          >
            <Input
              placeholder="Search for Queries"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              startAdornment={<SearchIcon />}
            />
          </div>

          <QueriesTable
            rows={rows}
            isLoading={isLoading}
            rowAsLink
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            rightSlot={<DataTable.RowCount />}
            skeletonRows={PAGE_SIZE}
            // The table has its own emptiness claim, and zero rows after a failed
            // or offline load would print "No queries found." under the strip
            // above. Same rule, one component down.
            emptyMessage={
              canClaimEmpty
                ? debouncedSearch
                  ? `No queries found matching "${debouncedSearch}". Try adjusting your search.`
                  : 'No queries found.'
                : loadErrorProps(isOffline, LOAD_ERROR_MESSAGE).message
            }
            hasMore={visibleCount < filteredQueries.length}
            onLoadMore={handleLoadMore}
          />
        </div>
      )}
      <ConfirmDeleteMonitoringModal
        open={!!queryToDelete}
        onOpenChange={open => {
          if (!open) setQueryToDelete(null);
        }}
        itemName={queryToDelete?.name ?? ''}
        itemType="query"
        onConfirm={() => {
          if (queryToDelete) {
            deleteQuery(queryToDelete.id, {
              onSuccess: () => setQueryToDelete(null),
            });
          }
        }}
      />
    </PageLayout>
  );
}
