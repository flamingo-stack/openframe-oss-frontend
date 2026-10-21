'use client';

import { BracketCurlyEllipsisVrIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQueries } from '@/app/(app)/monitoring/hooks/use-queries';
import { formatQueryInterval, QueriesTable, type QueryTableRow } from '@/app/components/shared';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { useHostQueries } from '../../hooks/use-host-queries';
import type { Device } from '../../types/device.types';
import { TabEmptyState } from './tab-empty-state';

/**
 * Rows drawn while the device's query reports are read. The reports come as one unpaged list with no limit: a typical
 * device carries a handful of scheduled queries.
 */
const QUERIES_TAB_SKELETON_ROWS = 5;

interface QueriesTabProps {
  device: Device | null;
}

export function QueriesTab({ device }: QueriesTabProps) {
  const scopeLoading = useLoadingScope();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // The host↔query set comes from `/fleet/hosts/{id}/queries` (the only host-filtered
  // endpoint). Frequency isn't in that payload, so we join the global `/fleet/queries`
  // list (team-scoped) by id to recover each query's `interval` — same column the
  // /monitoring Queries page shows.
  const { data: hostReports, isLoading: reportsLoading } = useHostQueries(device?.fleetId);
  const { queries, isLoading: queriesLoading } = useQueries(
    device?.fleetTeamId ? { team_id: device.fleetTeamId } : undefined,
  );

  const intervalById = useMemo(() => new Map(queries.map(q => [q.id, q.interval])), [queries]);

  const rows = useMemo<QueryTableRow[]>(() => {
    const query = search.trim().toLowerCase();
    return hostReports
      .filter(
        r => !query || r.name.toLowerCase().includes(query) || (r.description ?? '').toLowerCase().includes(query),
      )
      .map(r => ({
        id: String(r.report_id),
        name: r.name,
        description: r.description,
        frequencyLabel: formatQueryInterval(intervalById.get(r.report_id) ?? 0),
        actions: [{ label: 'Query Details', onClick: () => router.push(routes.monitoring.query(r.report_id)) }],
        href: routes.monitoring.query(r.report_id),
      }));
  }, [hostReports, intervalById, search, router]);

  // The device itself (the page's scope) or its query reports are still being read.
  const loading = scopeLoading || reportsLoading || queriesLoading;

  if (!loading && !device) {
    return (
      <TabEmptyState
        icon={<BracketCurlyEllipsisVrIcon />}
        title="No queries found"
        description="Scheduled queries for this device will appear here."
      />
    );
  }

  // No queries assigned to this host at all → the centered design empty state
  // matching the other tabs; the in-table empty stays for searches.
  if (!loading && hostReports.length === 0) {
    return (
      <TabEmptyState
        icon={<BracketCurlyEllipsisVrIcon />}
        title="No queries yet"
        description="Real-time questions you ask across your fleet (which devices have Chrome installed, who is on an outdated OS, which machines are low on disk) will be displayed here."
      />
    );
  }

  // Hide the search on a truly empty table (no rows, no active search, not loading) so the
  // tab shows only the centered empty state — matching the table's hidden header.
  const showSearch = loading || rows.length > 0 || search.trim().length > 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {showSearch && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          <Input
            userValue
            placeholder="Search for Query"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
            startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
          />
        </div>
      )}

      <QueriesTable
        rows={rows}
        isLoading={loading}
        pageSize={QUERIES_TAB_SKELETON_ROWS}
        rowAsLink
        stickyHeaderOffset={stickyHeaderOffset}
        emptyState={{
          icon: <BracketCurlyEllipsisVrIcon />,
          title: 'No queries found',
          description: search.trim()
            ? `No results for "${search.trim()}".`
            : 'Scheduled queries for this device will appear here.',
        }}
      />
    </div>
  );
}
