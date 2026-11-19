'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { deviceSoftwareTableQuery as DeviceSoftwareTableQueryType } from '@/__generated__/deviceSoftwareTableQuery.graphql';
import type { SoftwareListFrameRenderProps } from '@/app/(app)/software/components/shared/software-list-frame';
import { SOFTWARE_LIST_PAGE_SIZE } from '@/app/(app)/software/components/software-list/software-list-columns';
import { SoftwareTable } from '@/app/(app)/software/components/software-list/software-table';
import { useRetryKey } from '@/app/components/shared';
import { StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';

/**
 * Device → Software: what is installed on this machine, one row per title —
 * the same `Software` node the fleet-wide list shows, read in this device's
 * scope (the version is the one installed here), drawn by the same table.
 * Search goes to the server. One page at a time, its cursor in the URL (`softwareCursor`).
 */
const deviceSoftwareTableQuery = graphql`
  query deviceSoftwareTableQuery($machineId: String!, $search: String, $first: Int!, $after: String) {
    deviceSoftware(machineId: $machineId, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          ...softwareTable_software
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

interface DeviceSoftwareTableProps extends Pick<
  SoftwareListFrameRenderProps,
  'pager' | 'pageVariables' | 'paramPrefix'
> {
  machineId: string;
  debouncedSearch: string;
  /** True while a refetch is in flight — guards the empty state so it never flashes on stale data. */
  isPending: boolean;
  /** Drawn for a device with nothing installed; the tab picks the copy from the pipeline's stage. */
  emptyState: ReactNode;
  /** Nothing installed at all (not a search miss) — the tab drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The Software tab's rows, with their own boundary: in its scope the reader draws its own loading form. */
export function DeviceSoftwareTable(props: DeviceSoftwareTableProps) {
  return (
    <StaleCursorBoundary cursor={props.pager.cursor} onStaleCursor={props.pager.dropCursor}>
      <LoadingSuspense label="Loading software">
        <DeviceSoftwareTableReader {...props} />
      </LoadingSuspense>
    </StaleCursorBoundary>
  );
}

/**
 * The Software tab's rows. In a loading scope (the device or the module's flag has not answered, or its boundary's
 * fallback) it draws the table's own loading state and runs no query; otherwise the query below.
 */
function DeviceSoftwareTableReader(props: DeviceSoftwareTableProps) {
  if (useLoadingScope()) return <SoftwareTable surface="device" stickyHeaderOffset={props.stickyHeaderOffset} />;
  return <DeviceSoftwareTableQuery {...props} />;
}

/** The Software tab's rows — suspends on the query, under the boundary above. */
function DeviceSoftwareTableQuery({
  machineId,
  debouncedSearch,
  isPending,
  emptyState,
  onEmptyChange,
  stickyHeaderOffset,
  pager,
  pageVariables,
  paramPrefix,
}: DeviceSoftwareTableProps) {
  const retryKey = useRetryKey();
  const variables = {
    machineId,
    search: debouncedSearch || null,
    ...forwardPage(pageVariables, SOFTWARE_LIST_PAGE_SIZE),
  };
  const data = useLazyLoadQuery<DeviceSoftwareTableQueryType>(deviceSoftwareTableQuery, variables, {
    fetchPolicy: 'store-or-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<DeviceSoftwareTableQueryType>(deviceSoftwareTableQuery, variables);

  const rows = data.deviceSoftware.edges.map(edge => edge.node);
  const paged = usePagedTable({
    pager,
    pageInfo: data.deviceSoftware.pageInfo,
    rowCount: rows.length,
    prefix: paramPrefix,
    refetch,
  });

  return (
    <SoftwareTable
      surface="device"
      rows={rows}
      totalCount={data.deviceSoftware.filteredCount}
      debouncedSearch={debouncedSearch}
      isPending={isPending}
      emptyState={emptyState}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}
