'use client';

import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useLazyLoadQuery, useMutation, usePaginationFragment } from 'react-relay';
import type {
  addAllDevicesToScheduleMutation as AddAllDevicesMutationType,
  DeviceFilterInput as RelayDeviceFilterInput,
} from '@/__generated__/addAllDevicesToScheduleMutation.graphql';
import type { addDevicesToScheduleMutation as AddDevicesMutationType } from '@/__generated__/addDevicesToScheduleMutation.graphql';
import type { removeAllDevicesFromScheduleMutation as RemoveAllDevicesMutationType } from '@/__generated__/removeAllDevicesFromScheduleMutation.graphql';
import type { removeDevicesFromScheduleMutation as RemoveDevicesMutationType } from '@/__generated__/removeDevicesFromScheduleMutation.graphql';
import type {
  scheduleDevicePickerRelay_query$data as AvailableFragmentData,
  scheduleDevicePickerRelay_query$key as AvailableFragmentKey,
} from '@/__generated__/scheduleDevicePickerRelay_query.graphql';
import type {
  scheduleDevicePickerRelay_schedule$data as AssignedFragmentData,
  scheduleDevicePickerRelay_schedule$key as AssignedFragmentKey,
} from '@/__generated__/scheduleDevicePickerRelay_schedule.graphql';
import type { scheduleDevicePickerRelayAssignedPaginationQuery as AssignedPaginationQueryType } from '@/__generated__/scheduleDevicePickerRelayAssignedPaginationQuery.graphql';
import type { scheduleDevicePickerRelayAssignedQuery as AssignedQueryType } from '@/__generated__/scheduleDevicePickerRelayAssignedQuery.graphql';
import type { scheduleDevicePickerRelayPaginationQuery as AvailablePaginationQueryType } from '@/__generated__/scheduleDevicePickerRelayPaginationQuery.graphql';
import type { scheduleDevicePickerRelayQuery as AvailableQueryType } from '@/__generated__/scheduleDevicePickerRelayQuery.graphql';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { DeviceSelector } from '@/app/components/shared/device-selector';
import type { DeviceSelectorNarrowing, SubTab } from '@/app/components/shared/device-selector/device-selector.types';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { addAllDevicesToScheduleMutation } from '@/graphql/scripts/add-all-devices-to-schedule-mutation';
import { addDevicesToScheduleMutation } from '@/graphql/scripts/add-devices-to-schedule-mutation';
import { removeAllDevicesFromScheduleMutation } from '@/graphql/scripts/remove-all-devices-from-schedule-mutation';
import { removeDevicesFromScheduleMutation } from '@/graphql/scripts/remove-devices-from-schedule-mutation';
import {
  scheduleDevicePickerRelayAssignedFragment,
  scheduleDevicePickerRelayAssignedQuery,
  scheduleDevicePickerRelayFragment,
  scheduleDevicePickerRelayQuery,
} from '@/graphql/scripts/schedule-device-picker-relay';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { ScheduleInfoBarFromData } from '../../components/schedule/schedule-info-bar';
import { machineToDevice } from '../utils/machine-to-device';
import { formatScheduleStartAt, repeatToLabel } from '../utils/schedule-timing';
import { platformsToIds } from '../utils/script-mappers';
import { type ScheduleDetailData, ScheduleDetailGate } from './schedule-detail-gate';
import { ScheduleInfoBarSkeleton } from './schedule-details-view';
import { ScriptPageChrome } from './script-page-chrome';

const PAGE_SIZE = 20;

const EMPTY_NARROWING: DeviceSelectorNarrowing = { columnFilters: [], tags: [] };

/**
 * Turns the picker's narrowing vocabulary into the backend's.
 *
 * The component speaks in table column filters and `key:value` chips because
 * that is what its controls produce; the schedule's device fields take a
 * `DeviceFilterInput`. A plain-text chip (no colon) stays on screen but carries
 * no filter — same as the devices page.
 */
function narrowingToFilter(narrowing: DeviceSelectorNarrowing): DeviceFilterInput {
  const column = (id: string) => narrowing.columnFilters.find(f => f.id === id)?.value as string[] | undefined;
  const tagPairs = narrowing.tags.flatMap(t => {
    const i = t.indexOf(':');
    return i > 0 ? [{ key: t.slice(0, i), value: t.slice(i + 1) }] : [];
  });

  const filter: DeviceFilterInput = {};
  const statuses = column('status');
  const osTypes = column('os');
  const organizationIds = column('organization');
  if (statuses?.length) filter.statuses = statuses;
  if (osTypes?.length) filter.osTypes = osTypes;
  if (organizationIds?.length) filter.organizationIds = organizationIds;
  if (tagPairs.length) {
    filter.tagKeys = tagPairs.map(t => t.key);
    filter.tagValues = tagPairs.map(t => t.value);
  }
  return filter;
}

type MachineEdges = ReadonlyArray<
  { readonly node?: Parameters<typeof machineToDevice>[0] | null } | null | undefined
> | null;

function toDevices(edges: MachineEdges | undefined): Device[] {
  return (edges ?? []).flatMap(edge => (edge?.node ? [machineToDevice(edge.node)] : []));
}

/**
 * The same filter, in the shape Relay's generated inputs expect.
 *
 * `DeviceFilterInput` is declared twice: the app's hand-written one types the
 * enum fields as plain strings (it feeds REST-ish call sites), while relay-
 * compiler types them as the schema's enums. The values here come from the
 * backend's own facet options, so they ARE members of those enums — the cast
 * states that rather than duplicating the filter builder per operation.
 */
function toRelayFilter(filter: DeviceFilterInput): RelayDeviceFilterInput {
  return filter as RelayDeviceFilterInput;
}

interface ScheduleDevicesContentProps {
  scheduleId: string;
  /** `undefined` while the gated schedule query is in flight. */
  schedule: ScheduleDetailData | undefined;
}

interface SchedulePickerListsProps extends ScheduleDevicesContentProps {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  narrowing: DeviceSelectorNarrowing;
  onNarrowingChange: (next: DeviceSelectorNarrowing) => void;
  /** Live narrowing — drives the facet query, which has its own cache. */
  filter: DeviceFilterInput;
  /** Deferred narrowing — what the two lists are actually reading. */
  deferredFilter: DeviceFilterInput;
  deferredSearch: string;
  busy: boolean;
  onAdd: (device: Device) => void;
  onRemove: (device: Device) => void;
  onAddAll: () => void;
  onRemoveAll: () => void;
  /** Bumped after a mutation to make both lists re-read from the network. */
  refetchSignal: number;
}

/**
 * Both halves of the picker, each its own server-narrowed connection.
 *
 * They are read TOGETHER rather than one per active tab: switching tabs then
 * costs nothing and never unmounts the picker (which would drop the search box
 * mid-typing). Two pages of twenty is also less than the page used to pull —
 * it fetched up to 200 candidates plus the entire assignment before rendering.
 */
function SchedulePickerLists({
  scheduleId,
  schedule,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  narrowing,
  onNarrowingChange,
  filter,
  deferredFilter,
  deferredSearch,
  busy,
  onAdd,
  onRemove,
  onAddAll,
  onRemoveAll,
  refetchSignal,
}: SchedulePickerListsProps) {
  const variables = {
    scheduleId,
    filter: toRelayFilter(deferredFilter),
    search: deferredSearch || null,
    first: PAGE_SIZE,
    after: null,
  };

  // `fetchKey` is what makes a committed change show up: the assignment moved on
  // the server in a way no client updater can reproduce, because membership of
  // either list depends on filters and search only the server evaluates.
  const availableData = useLazyLoadQuery<AvailableQueryType>(scheduleDevicePickerRelayQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: refetchSignal,
  });
  const assignedData = useLazyLoadQuery<AssignedQueryType>(scheduleDevicePickerRelayAssignedQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: refetchSignal,
  });

  const available = usePaginationFragment<AvailablePaginationQueryType, AvailableFragmentKey>(
    scheduleDevicePickerRelayFragment,
    availableData,
  );
  const assigned = usePaginationFragment<AssignedPaginationQueryType, AssignedFragmentKey>(
    scheduleDevicePickerRelayAssignedFragment,
    assignedData.scriptSchedule ?? null,
  );

  const availableConnection = (available.data as AvailableFragmentData | null)?.availableDevicesForSchedule;
  const assignedConnection = (assigned.data as AssignedFragmentData | null)?.assignedDevices;

  const availableRows = useMemo(() => toDevices(availableConnection?.edges), [availableConnection?.edges]);
  const assignedRows = useMemo(() => toDevices(assignedConnection?.edges), [assignedConnection?.edges]);

  const isAvailable = activeTab === 'available';
  const rows = isAvailable ? availableRows : assignedRows;
  const totalCount = (isAvailable ? availableConnection : assignedConnection)?.filteredCount;
  const hasNext = isAvailable ? available.hasNext : assigned.hasNext;
  const isLoadingNext = isAvailable ? available.isLoadingNext : assigned.isLoadingNext;
  const loadNext = isAvailable ? available.loadNext : assigned.loadNext;

  const loadMore = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  // Fleet-wide facets rather than counts taken off the rows in hand: with the
  // server paging, options derived from the current page would only ever offer
  // what page one happens to contain.
  const { data: filterOptions } = useDeviceFilters(filter);

  const { date, time } = formatScheduleStartAt(schedule?.startAt);

  return (
    <DeviceSelector
      devices={rows}
      loading={false}
      disabled={busy}
      infiniteScroll={{
        hasNextPage: hasNext,
        isFetchingNextPage: isLoadingNext,
        onLoadMore: loadMore,
        skeletonRows: 2,
      }}
      server={{
        activeTab,
        onTabChange,
        search,
        onSearchChange,
        narrowing,
        onNarrowingChange,
        filterOptions,
        // `deviceCount` would say this directly, but it is unusable
        // (docs/script-schedules-v2-graphql-gaps.md §9). `filteredCount` is the
        // same number whenever nothing is narrowed — and while a filter IS on,
        // a label reading fewer than the assignment is the lesser wrong than
        // one that takes the whole page down.
        selectedCount: assignedConnection?.filteredCount ?? 0,
        totalCount: totalCount ?? undefined,
        onAdd,
        onRemove,
        onAddAll,
        onRemoveAll,
      }}
      headerContent={
        schedule ? (
          <ScheduleInfoBarFromData
            name={schedule.name}
            note={schedule.description ?? ''}
            date={date}
            time={time}
            repeat={repeatToLabel(schedule.repeat)}
            platforms={platformsToIds(schedule.supportedPlatforms)}
            trigger={schedule.trigger}
          />
        ) : (
          <ScheduleInfoBarSkeleton />
        )
      }
    />
  );
}

/** The real picker in its loading state, so there is no separate skeleton to drift. */
function SchedulePickerSkeleton({ schedule }: { schedule: ScheduleDetailData | undefined }) {
  const { date, time } = formatScheduleStartAt(schedule?.startAt);
  return (
    <DeviceSelector
      devices={[]}
      loading
      readOnly
      headerContent={
        schedule ? (
          <ScheduleInfoBarFromData
            name={schedule.name}
            note={schedule.description ?? ''}
            date={date}
            time={time}
            repeat={repeatToLabel(schedule.repeat)}
            platforms={platformsToIds(schedule.supportedPlatforms)}
            trigger={schedule.trigger}
          />
        ) : (
          <ScheduleInfoBarSkeleton />
        )
      }
    />
  );
}

function ScheduleDevicesContent({ scheduleId, schedule }: ScheduleDevicesContentProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<SubTab>('available');
  const [search, setSearch] = useState('');
  const [narrowing, setNarrowing] = useState<DeviceSelectorNarrowing>(EMPTY_NARROWING);
  const [refetchSignal, setRefetchSignal] = useState(0);

  const debouncedSearch = useDebounce(search, 300);
  const filter = useMemo(() => narrowingToFilter(narrowing), [narrowing]);
  const { deferredFilters: deferredFilter, deferredSearch } = useDeferredQuery(filter, debouncedSearch);

  const [commitAdd, isAdding] = useMutation<AddDevicesMutationType>(addDevicesToScheduleMutation);
  const [commitRemove, isRemoving] = useMutation<RemoveDevicesMutationType>(removeDevicesFromScheduleMutation);
  const [commitAddAll, isAddingAll] = useMutation<AddAllDevicesMutationType>(addAllDevicesToScheduleMutation);
  const [commitRemoveAll, isRemovingAll] = useMutation<RemoveAllDevicesMutationType>(
    removeAllDevicesFromScheduleMutation,
  );
  const busy = isAdding || isRemoving || isAddingAll || isRemovingAll;

  // The bulk actions must send the narrowing as it is AT CLICK TIME; a ref keeps
  // the handlers reference-stable so the memoized rows don't re-render on every
  // keystroke in the search box.
  const narrowingRef = useRef({ filter, search: debouncedSearch });
  narrowingRef.current = { filter, search: debouncedSearch };

  const refresh = useCallback(() => setRefetchSignal(n => n + 1), []);

  const errorHandler = useCallback(
    (fallback: string) => (error: Error) => {
      toast({ title: 'Error', description: getRelayErrorMessage(error, fallback), variant: 'destructive' });
    },
    [toast],
  );

  const handleAdd = useCallback(
    (device: Device) => {
      commitAdd({
        variables: { scheduleId, machineIds: [device.id] },
        onCompleted: () => {
          toast({
            title: 'Device assigned',
            description: `"${device.displayName || device.hostname}" was added to this schedule.`,
            variant: 'success',
          });
          refresh();
        },
        onError: errorHandler('Failed to assign device'),
      });
    },
    [commitAdd, scheduleId, toast, refresh, errorHandler],
  );

  const handleRemove = useCallback(
    (device: Device) => {
      commitRemove({
        variables: { scheduleId, machineIds: [device.id] },
        onCompleted: () => {
          toast({
            title: 'Device unassigned',
            description: `"${device.displayName || device.hostname}" was removed from this schedule.`,
            variant: 'success',
          });
          refresh();
        },
        onError: errorHandler('Failed to unassign device'),
      });
    },
    [commitRemove, scheduleId, toast, refresh, errorHandler],
  );

  const handleAddAll = useCallback(() => {
    const { filter: f, search: s } = narrowingRef.current;
    commitAddAll({
      variables: { scheduleId, filter: toRelayFilter(f), search: s || null },
      onCompleted: () => {
        toast({
          title: 'Devices assigned',
          description: 'Every device matching the current filters was added to this schedule.',
          variant: 'success',
        });
        refresh();
      },
      onError: errorHandler('Failed to assign devices'),
    });
  }, [commitAddAll, scheduleId, toast, refresh, errorHandler]);

  const handleRemoveAll = useCallback(() => {
    const { filter: f, search: s } = narrowingRef.current;
    commitRemoveAll({
      variables: { scheduleId, filter: toRelayFilter(f), search: s || null },
      onCompleted: () => {
        toast({
          title: 'Devices unassigned',
          description: 'Every device matching the current filters was removed from this schedule.',
          variant: 'success',
        });
        refresh();
      },
      onError: errorHandler('Failed to unassign devices'),
    });
  }, [commitRemoveAll, scheduleId, toast, refresh, errorHandler]);

  // Each tab narrows its own list, and carrying one tab's search into the other
  // would silently hide rows the user never filtered.
  const handleTabChange = useCallback((tab: SubTab) => {
    setActiveTab(tab);
    setSearch('');
    setNarrowing(EMPTY_NARROWING);
  }, []);

  // Every change is committed as it is made, so the only thing left for the
  // primary action is to leave — "Done", not "Save Devices".
  const actions = useMemo<PageActionButton[]>(
    () => [
      {
        label: 'Done',
        onClick: () => safeBackOrReplace(router, routes.scriptsV2.schedules.details(scheduleId, { tab: 'devices' })),
        variant: 'accent' as const,
        disabled: busy,
      },
    ],
    [router, scheduleId, busy],
  );

  return (
    <ScriptPageChrome
      title="Schedule Devices"
      backFallback={routes.scriptsV2.schedules.details(scheduleId)}
      actionsVariant="primary-buttons"
      showMobileCancel
      actions={actions}
    >
      <Suspense fallback={<SchedulePickerSkeleton schedule={schedule} />}>
        <SchedulePickerLists
          scheduleId={scheduleId}
          schedule={schedule}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          search={search}
          onSearchChange={setSearch}
          narrowing={narrowing}
          onNarrowingChange={setNarrowing}
          filter={filter}
          deferredFilter={deferredFilter}
          deferredSearch={deferredSearch}
          busy={busy}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onAddAll={handleAddAll}
          onRemoveAll={handleRemoveAll}
          refetchSignal={refetchSignal}
        />
      </Suspense>
    </ScriptPageChrome>
  );
}

interface ScheduleDevicesViewProps {
  scheduleId: string;
}

/**
 * "Edit Devices" for a schedule (v2, Relay).
 *
 * Every +/− commits the moment it is clicked, through the incremental
 * `addDevicesToSchedule` / `removeDevicesFromSchedule` pair and their bulk
 * counterparts — which is why the page exits via Done rather than Save. That is
 * not a style choice. The previous `setScriptScheduleDevices` took the WHOLE
 * machine set and overwrote the assignment with it, so the editor had to hold
 * the entire assignment in memory or delete the part it had never read; it
 * could not, once an assignment outgrew the single page it fetched. "Add All
 * Devices" had the matching flaw, adding only the candidates the client had
 * paged in. Both lists and both bulk actions are resolved server-side now.
 */
export function ScheduleDevicesView({ scheduleId }: ScheduleDevicesViewProps) {
  return (
    <ScheduleDetailGate scheduleId={scheduleId}>
      {schedule => <ScheduleDevicesContent scheduleId={scheduleId} schedule={schedule} />}
    </ScheduleDetailGate>
  );
}
