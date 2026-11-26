'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  type DeviceFilters,
  DevicesList,
  type DevicesListNarrowing,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { MonitorOffIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AutoRefreshControl, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import type { scriptScheduleDevicesRelayQuery as ScheduleDevicesQueryType } from '@/__generated__/scriptScheduleDevicesRelayQuery.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { machineRowToDevice } from '@/app/(app)/devices/utils/device-transform';
import { ContentErrorBoundary, NO_ITEMS, useRetryKey } from '@/app/components/shared';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { type DeviceConnectivity, type DeviceStatus, ScheduleDeviceSelectionMode } from '@/generated/schema-enums';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import { scriptScheduleDevicesRelayQuery } from '@/graphql/scripts/script-schedule-devices-relay';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { criteriaFromStored } from '../utils/schedule-criteria';
import { ScheduleCriteriaSummary } from './schedule-criteria-fields';
import { ScheduleDeviceFacets } from './schedule-device-facets';

/** How many assigned devices a page holds. */
const PAGE_SIZE = 20;

/**
 * The tab's params live under this prefix (`deviceSearch`, `deviceStatuses`, `deviceConnectivity`, `deviceOsTypes`,
 * `deviceOrganizationIds`, `deviceTags`, `deviceCursor`, `devicePage`, `deviceRefresh`): the Schedule Runs and
 * Execution History tabs on the same page keep theirs under `run…` and `exec…`, and a shared key would carry one
 * table's narrowing into another on a tab switch.
 */
const PARAM_PREFIX = 'device';

/** Design 1:48865 — the placeholder for a schedule nothing is assigned to. */
const EMPTY_STATE = {
  icon: <MonitorOffIcon />,
  title: 'No Assigned Devices',
  description: 'Devices added to this schedule will be displayed here.',
};

/**
 * The `DeviceFilterInput` fields this list can set. Declared here rather than
 * imported from the Relay artifact — relay-compiler owns and prunes those — with
 * the enum coming from the generated SDL enums, per the project rule.
 */
interface AssignedDevicesFilter {
  statuses?: DeviceStatus[] | null;
  connectivity?: DeviceConnectivity[] | null;
  osTypes?: string[];
  organizationIds?: string[];
  tagValues?: string[];
}

/**
 * The narrowing, in the shape `assignedDevices(filter:)` takes. Only the fields
 * `DeviceFilterInput` actually has — a bare tag chip (no `key:value`) narrows
 * nothing, exactly as on the fleet page.
 */
function toDeviceFilter(narrowing: Omit<DevicesListNarrowing, 'search'>): AssignedDevicesFilter {
  const tagValues = narrowing.tags.flatMap(tag => {
    const i = tag.indexOf(':');
    return i > 0 ? [tag.slice(i + 1)] : [];
  });

  return {
    // UI statuses (MANAGED stands for the legacy ONLINE / OFFLINE too) and connectivity, through the one boundary
    // that knows whether the backend has MANAGED.
    ...(narrowing.statuses.length > 0 && { statuses: toRelayDeviceFilter({ statuses: narrowing.statuses })?.statuses }),
    ...(narrowing.connectivity?.length && {
      connectivity: toRelayDeviceFilter({ connectivity: narrowing.connectivity })?.connectivity,
    }),
    ...(narrowing.osTypes.length > 0 && { osTypes: narrowing.osTypes }),
    ...(narrowing.organizationIds.length > 0 && { organizationIds: narrowing.organizationIds }),
    ...(tagValues.length > 0 && { tagValues }),
  };
}

interface ScheduleDevicesTabContentProps {
  scheduleId: string;
  /** What the list draws as narrowed: the URL's funnels and tag chips, the box's typed search. */
  narrowing: DevicesListNarrowing;
  onNarrowingChange: (next: DevicesListNarrowing) => void;
  /** Deferred — the URL's funnels and tag chips, as `assignedDevices(filter:)` takes them. */
  filter: AssignedDevicesFilter;
  /** Deferred — the URL's search (never the box's: see the tab). */
  search: string;
  /** A deferred value lags the URL: the rows on screen are the previous result. */
  isPending: boolean;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/**
 * The part that reads the assignment, and therefore the part that suspends.
 *
 * The list itself is the shared {@link DevicesList}, the same one the fleet page
 * shows: same columns, same search, same tag chips, same funnels. The one thing
 * a schedule owns is where the rows come from — `assignedDevices`, not `devices`,
 * because no `DeviceFilterInput` field can express "assigned to this schedule".
 * Everything else is the fleet page's contract: the narrowing goes to the SERVER
 * (that connection takes the same `filter` / `search` as the top-level query), so
 * it applies to the whole assignment rather than to the page on screen.
 *
 * That includes the column funnels, which this tab used to go without: their
 * options would have had to come from the TENANT-wide `deviceFilters`, offering
 * statuses and customers this assignment does not contain. The 2026-08-04 schema
 * added `ScriptSchedule.assignedDeviceFilters(filter, search)` — the same facet
 * shape resolved over this schedule's own machines — so the funnels are back and
 * every option in them narrows something. Tag chips are the one exception, still
 * fleet-fed; see `useScheduleDeviceFilters`.
 */
function ScheduleDevicesTabContent({
  scheduleId,
  narrowing,
  onNarrowingChange,
  filter,
  search,
  isPending,
  pager,
  pageVariables,
}: ScheduleDevicesTabContentProps) {
  const retryKey = useRetryKey();
  const detail = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );

  // One page per request, its cursor in the URL (`deviceCursor`); forward only (see the query).
  const variables = { id: scheduleId, filter, search: search || null, ...forwardPage(pageVariables, PAGE_SIZE) };
  const queryData = useLazyLoadQuery<ScheduleDevicesQueryType>(scriptScheduleDevicesRelayQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<ScheduleDevicesQueryType>(scriptScheduleDevicesRelayQuery, variables);

  const assigned = queryData.scriptSchedule?.assignedDevices;
  const edges = assigned?.edges ?? NO_ITEMS;
  // Defensive null-node guard: skip any dangling edge instead of crashing the tab on a store-evicted record.
  const devices: Device[] = edges.flatMap(edge => (edge?.node ? [machineRowToDevice(edge.node)] : []));
  const paged = usePagedTable({
    pager,
    pageInfo: assigned?.pageInfo,
    rowCount: edges.length,
    prefix: PARAM_PREFIX,
    refetch,
    isPending,
  });

  const schedule = detail.scriptSchedule;
  const criteria = useMemo(() => criteriaFromStored(schedule?.deviceCriteria), [schedule?.deviceCriteria]);

  const list = (deviceFilters: DeviceFilters | null) => (
    <DevicesList
      devices={devices}
      deviceFilters={deviceFilters}
      narrowing={narrowing}
      onNarrowingChange={onNarrowingChange}
      isPending={isPending}
      // The server's count for the CURRENT narrowing: honest whether or not
      // anything is narrowed, since the narrowing is the server's too.
      totalCount={assigned?.filteredCount ?? undefined}
      // "Nothing is assigned" is page 1's to say: an empty LATER page is a cursor about to be dropped.
      emptyState={pager.isFirstPage ? EMPTY_STATE : undefined}
      skeletonRows={PAGE_SIZE}
      metaRow={{ pager: paged.pager, actions: paged.refresh && <AutoRefreshControl {...paged.refresh} /> }}
    />
  );

  // Not-found is reported once, by the timing bar above; render nothing here.
  if (!schedule) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]">
      {/* The criteria summary mounts the customer query it needs to name the ids
          in the rule — so a schedule that names its devices directly never
          issues it. */}
      {schedule.selectionMode === ScheduleDeviceSelectionMode.CRITERIA && (
        <ScheduleCriteriaSummary criteria={criteria} />
      )}

      {/* Facets scoped to THIS schedule's machines, but NOT to the current narrowing: a
          funnel that answers through its own selection offers one option after the
          first click (see the hook). Read under a boundary of their own, so a failed
          facet read draws the list without funnels (see `ScheduleDeviceFacets`). */}
      <ContentErrorBoundary label="DeviceFilters" resetKey={scheduleId} fallback={() => list(null)}>
        <ScheduleDeviceFacets scheduleId={scheduleId} half="assigned">
          {list}
        </ScheduleDeviceFacets>
      </ContentErrorBoundary>
    </div>
  );
}

/**
 * The tab's rows under the stale-cursor boundary: a cursor the server refuses drops to the first page; any other
 * error goes up unchanged.
 */
function ScheduleDevicesTabBody(props: ScheduleDevicesTabContentProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <ScheduleDevicesTabLoading {...props} />
    </StaleCursorBoundary>
  );
}

/**
 * The tab's loading boundary, the whole output of its own component (the loading standard): a tab that suspends is
 * the tab's business, not the page's, so switching to it draws the tab's loading state and leaves the header, the
 * timing bar and the tab strip untouched.
 */
function ScheduleDevicesTabLoading(props: ScheduleDevicesTabContentProps) {
  return (
    <LoadingSuspense label="Loading devices">
      <ScheduleDevicesTabReader {...props} />
    </LoadingSuspense>
  );
}

function ScheduleDevicesTabReader(props: ScheduleDevicesTabContentProps) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws the same list in its loading
  // state, the typed narrowing kept, and runs no read.
  if (useLoadingScope()) {
    return (
      <div className="pt-[var(--spacing-system-l)]">
        <DevicesList
          devices={NO_ITEMS}
          isLoading
          narrowing={props.narrowing}
          onNarrowingChange={props.onNarrowingChange}
          emptyState={EMPTY_STATE}
          skeletonRows={PAGE_SIZE}
        />
      </div>
    );
  }
  return <ScheduleDevicesTabContent {...props} />;
}

/**
 * "Assigned Devices" tab — the machines this schedule runs on, one page at a time with First · Prev · Next.
 *
 * The narrowing lives in the URL under the `device` prefix (see `PARAM_PREFIX`), with the pager beside it: a change to
 * the search, a funnel or a tag chip drops the cursor in the SAME URL write (one history entry on page 2+, so Back
 * returns to the old view). The box keeps the typed search locally; the query reads the URL's, so a search and a
 * cursor from another narrowing never meet in one request.
 *
 * `memo` for the reason given in `schedule-detail-tabs.ts`.
 */
export const ScheduleDevicesTab = memo(function ScheduleDevicesTabImpl({ scheduleId }: { scheduleId: string }) {
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      statuses: { type: 'array', default: [] },
      connectivity: { type: 'array', default: [] },
      osTypes: { type: 'array', default: [] },
      organizationIds: { type: 'array', default: [] },
      tags: { type: 'array', default: [] },
    },
    { prefix: PARAM_PREFIX, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    prefix: PARAM_PREFIX,
    pageSize: PAGE_SIZE,
    ...PAGED_LISTS.assignedDevices,
    resetOn: JSON.stringify(params),
  });

  // Typing is a keystroke; a query is not. The box keeps the typed value and the shared hook debounces it into the
  // URL, the same 500ms the fleet page waits before its search reaches the API.
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    500,
  );

  // Memoized on the individual selections for its identity: `useDeferredQuery` tells a pending refetch by comparing
  // references, and a keystroke in the box must not dim the table for a filter that never changed.
  const { statuses, connectivity, osTypes, organizationIds, tags } = params;
  const filter = useMemo(
    () => toDeviceFilter({ statuses, connectivity, osTypes, organizationIds, tags }),
    [statuses, connectivity, osTypes, organizationIds, tags],
  );

  // Deferred variables, page included: a filter, search or page change keeps the rows (and the search box, and its
  // focus) on screen, dimmed, while the next ones are read, instead of dropping the list to the tab's fallback.
  const { deferredFilters, deferredSearch, deferredPage, isPending } = useDeferredQuery(
    filter,
    params.search,
    pager.variables,
  );

  const narrowing: DevicesListNarrowing = {
    search: searchInput,
    statuses,
    connectivity,
    osTypes,
    organizationIds,
    tags,
  };
  // The list reports the whole narrowing on every change: the search goes to the box, the rest to the URL (a write
  // that changes nothing is dropped by `useApiParams`).
  const handleNarrowingChange = (next: DevicesListNarrowing) => {
    if (next.search !== searchInput) setSearchInput(next.search);
    setParams({
      statuses: next.statuses,
      connectivity: next.connectivity ?? [],
      osTypes: next.osTypes,
      organizationIds: next.organizationIds,
      tags: next.tags,
    });
  };

  return (
    <ScheduleDevicesTabBody
      scheduleId={scheduleId}
      narrowing={narrowing}
      onNarrowingChange={handleNarrowingChange}
      filter={deferredFilters}
      search={deferredSearch}
      isPending={isPending}
      pager={pager}
      pageVariables={deferredPage}
    />
  );
});
ScheduleDevicesTab.displayName = 'ScheduleDevicesTab';
