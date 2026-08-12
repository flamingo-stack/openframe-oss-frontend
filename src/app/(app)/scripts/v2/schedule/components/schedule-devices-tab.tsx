'use client';

import { MonitorOffIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, Suspense, useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scriptScheduleDetailRelayQuery as ScheduleDetailQueryType } from '@/__generated__/scriptScheduleDetailRelayQuery.graphql';
import type { scriptScheduleDevicesRelay_schedule$key as ScheduleDevicesFragmentKey } from '@/__generated__/scriptScheduleDevicesRelay_schedule.graphql';
import type { scriptScheduleDevicesRelayPaginationQuery as ScheduleDevicesPaginationQueryType } from '@/__generated__/scriptScheduleDevicesRelayPaginationQuery.graphql';
import type { scriptScheduleDevicesRelayQuery as ScheduleDevicesQueryType } from '@/__generated__/scriptScheduleDevicesRelayQuery.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { machineToDevice } from '@/app/(app)/devices/utils/device-transform';
import { DevicesList, type DevicesListNarrowing, EMPTY_DEVICES_NARROWING, useRetryKey } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { type DeviceStatus, ScheduleDeviceSelectionMode } from '@/generated/schema-enums';
import { scriptScheduleDetailRelayQuery } from '@/graphql/scripts/script-schedule-detail-relay';
import {
  scriptScheduleDevicesRelayFragment,
  scriptScheduleDevicesRelayQuery,
} from '@/graphql/scripts/script-schedule-devices-relay';
import { useScheduleDeviceFilters } from '../hooks/use-schedule-device-filters';
import { criteriaFromStored } from '../utils/schedule-criteria';
import { ScheduleCriteriaSummary } from './schedule-criteria-fields';

/** How many assigned devices load per page. */
const PAGE_SIZE = 20;

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
  statuses?: DeviceStatus[];
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
    ...(narrowing.statuses.length > 0 && { statuses: narrowing.statuses as DeviceStatus[] }),
    ...(narrowing.osTypes.length > 0 && { osTypes: narrowing.osTypes }),
    ...(narrowing.organizationIds.length > 0 && { organizationIds: narrowing.organizationIds }),
    ...(tagValues.length > 0 && { tagValues }),
  };
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
 * it applies to the whole assignment rather than to the pages loaded so far.
 *
 * That includes the column funnels, which this tab used to go without: their
 * options would have had to come from the TENANT-wide `deviceFilters`, offering
 * statuses and customers this assignment does not contain. The 2026-08-04 schema
 * added `ScriptSchedule.assignedDeviceFilters(filter, search)` — the same facet
 * shape resolved over this schedule's own machines — so the funnels are back and
 * every option in them narrows something. Tag chips are the one exception, still
 * fleet-fed; see `useScheduleDeviceFilters`.
 */
function ScheduleDevicesTabContent({ scheduleId }: { scheduleId: string }) {
  const retryKey = useRetryKey();
  const detail = useLazyLoadQuery<ScheduleDetailQueryType>(
    scriptScheduleDetailRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );

  const [narrowing, setNarrowing] = useState<DevicesListNarrowing>(EMPTY_DEVICES_NARROWING);

  // Memoized on the individual selections, NOT on `narrowing`: every keystroke
  // in the search box replaces that object, and rebuilding the filter with it
  // would hand `useDeferredQuery` a new identity per character — dimming the
  // table on each one for a filter that never changed.
  const { statuses, osTypes, organizationIds, tags } = narrowing;
  const filter = useMemo(
    () => toDeviceFilter({ statuses, osTypes, organizationIds, tags }),
    [statuses, osTypes, organizationIds, tags],
  );

  // Typing is a keystroke; a query is not. The fleet page debounces the same
  // 500ms before its search reaches the API.
  const debouncedSearch = useDebounce(narrowing.search, 500);

  // Deferred variables: a filter or search change keeps the rows (and the search
  // box, and its focus) on screen while the refetch is in flight, instead of
  // dropping the whole list to the tab's Suspense fallback.
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(filter, debouncedSearch);

  const queryData = useLazyLoadQuery<ScheduleDevicesQueryType>(
    scriptScheduleDevicesRelayQuery,
    { id: scheduleId, first: PAGE_SIZE, after: null, filter: deferredFilters, search: deferredSearch || null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ScheduleDevicesPaginationQueryType,
    ScheduleDevicesFragmentKey
  >(scriptScheduleDevicesRelayFragment, queryData.scriptSchedule ?? null);

  // Scoped to THIS schedule's machines, but NOT to the current narrowing — a
  // funnel that answers through its own selection offers one option after the
  // first click. See the hook.
  const deviceFilters = useScheduleDeviceFilters(scheduleId, 'assigned');

  const devices = useMemo<Device[]>(() => {
    const edges = data?.assignedDevices?.edges ?? [];
    // Defensive null-node guard: skip any dangling edge instead of crashing the
    // tab on a store-evicted record.
    return edges.flatMap(edge => (edge?.node ? [machineToDevice(edge.node)] : []));
  }, [data?.assignedDevices?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  const schedule = detail.scriptSchedule;
  const criteria = useMemo(() => criteriaFromStored(schedule?.deviceCriteria), [schedule?.deviceCriteria]);

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

      <DevicesList
        devices={devices}
        deviceFilters={deviceFilters}
        narrowing={narrowing}
        onNarrowingChange={setNarrowing}
        isPending={isPending}
        // The server's count for the CURRENT narrowing — honest whether or not
        // anything is narrowed, since the narrowing is the server's too.
        totalCount={data?.assignedDevices?.filteredCount ?? undefined}
        emptyState={EMPTY_STATE}
        infiniteScroll={{
          hasNextPage: hasNext,
          isFetchingNextPage: isLoadingNext,
          onLoadMore: fetchNextPage,
          skeletonRows: 2,
        }}
      />
    </div>
  );
}

export function ScheduleDevicesTabSkeleton() {
  return (
    <div className="pt-[var(--spacing-system-l)]">
      <DevicesList devices={[]} isLoading emptyState={EMPTY_STATE} />
    </div>
  );
}

/**
 * "Assigned Devices" tab — the machines this schedule runs on.
 *
 * Carries its own boundary: a tab that suspends is the tab's business, not the
 * page's, so switching to it draws this skeleton and leaves the header, the
 * timing bar and the tab strip untouched.
 *
 * `memo` for the reason given in `schedule-detail-tabs.ts`.
 */
export const ScheduleDevicesTab = memo(function ScheduleDevicesTab({ scheduleId }: { scheduleId: string }) {
  return (
    <Suspense fallback={<ScheduleDevicesTabSkeleton />}>
      <ScheduleDevicesTabContent scheduleId={scheduleId} />
    </Suspense>
  );
});
