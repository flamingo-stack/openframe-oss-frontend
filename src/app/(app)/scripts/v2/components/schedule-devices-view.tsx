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
import type {
  ScheduleDeviceCriteriaInput,
  setScheduleDeviceCriteriaMutation as SetCriteriaMutationType,
} from '@/__generated__/setScheduleDeviceCriteriaMutation.graphql';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { CONTENT_SWAP_ANIMATION } from '@/app/components/shared';
import { DeviceSelectionModeRadio, DeviceSelector } from '@/app/components/shared/device-selector';
import type {
  DeviceSelectionMode,
  DeviceSelectorNarrowing,
  SubTab,
} from '@/app/components/shared/device-selector/device-selector.types';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { ScheduleDeviceSelectionMode } from '@/generated/schema-enums';
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
import { setScheduleDeviceCriteriaMutation } from '@/graphql/scripts/set-schedule-device-criteria-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { ScheduleInfoBarFromData } from '../../components/schedule/schedule-info-bar';
import { machineToDevice } from '../utils/machine-to-device';
import {
  criteriaEqual,
  criteriaFromStored,
  criteriaToFilter,
  criteriaToInput,
  type ScheduleCriteria,
} from '../utils/schedule-criteria';
import { formatScheduleStartAt, repeatToLabel } from '../utils/schedule-timing';
import { platformsToIds } from '../utils/script-mappers';
import { ScheduleCriteriaFields, ScheduleCriteriaFieldsSkeleton } from './schedule-criteria-fields';
import { type ScheduleDetailData, ScheduleDetailGate } from './schedule-detail-gate';
import { ScheduleInfoBarSkeleton } from './schedule-details-view';
import { ScriptPageChrome } from './script-page-chrome';

const PAGE_SIZE = 20;

const EMPTY_NARROWING: DeviceSelectorNarrowing = { columnFilters: [], tags: [] };

/**
 * The criteria dropdowns must offer the whole fleet's dimensions, never just
 * what the rule being written already matches — otherwise picking one customer
 * makes the second unpickable. Module-level so the query key stays stable.
 */
const UNFILTERED: DeviceFilterInput = {};

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

/**
 * The same story one level up: the editor holds `deviceTypes` as strings, the
 * generated input wants the `DeviceType` union. The values are taken from the
 * `DeviceType` enum in `@/generated/schema-enums` (see `ScheduleCriteriaCard`),
 * so they are members of it — relay-compiler just emits its own copy of the
 * union per operation.
 */
function toRelayCriteria(criteria: ScheduleCriteria): ScheduleDeviceCriteriaInput {
  return criteriaToInput(criteria) as ScheduleDeviceCriteriaInput;
}

interface ScheduleDevicesContentProps {
  scheduleId: string;
  /** `undefined` while the gated schedule query is in flight. */
  schedule: ScheduleDetailData | undefined;
}

/**
 * The info bar and the mode radio are rendered by the PAGE, above the subtree
 * that swaps — so neither half of the editor draws them, and neither carries
 * `headerContent`.
 */
interface SchedulePickerListsProps {
  scheduleId: string;
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

  return (
    <DeviceSelector
      devices={rows}
      loading={false}
      disabled={busy}
      showSelectionModeRadio={false}
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
        // The WHOLE assignment, not `assignedConnection.filteredCount`: the tab
        // label names what is in the schedule, and that does not drop because
        // the user typed in the search box. The narrowed number belongs to the
        // list, which reports it itself.
        selectedCount: assignedData.scriptSchedule?.deviceCount ?? 0,
        totalCount: totalCount ?? undefined,
        onAdd,
        onRemove,
        onAddAll,
        onRemoveAll,
      }}
    />
  );
}

interface ScheduleCriteriaPickerProps {
  scheduleId: string;
  criteria: ScheduleCriteria;
  onCriteriaChange: (next: ScheduleCriteria) => void;
  busy: boolean;
}

/**
 * The "Select Devices by Criteria" half — the rule editor over a live preview
 * of what it matches.
 *
 * The preview runs the rule through `availableDevicesForSchedule`, the same
 * connection the Available list uses, with the criteria as its `filter`. That
 * is not a convenience: `ScheduleDeviceCriteriaInput` is a strict subset of
 * `DeviceFilterInput`, so the server answers "which devices does this rule
 * select?" itself — already scoped to the schedule's `supportedPlatforms`,
 * exactly as the stored rule will be. Nothing here re-implements the matching.
 *
 * Caveat carried over from that field's open question (see
 * docs/script-schedules-v2-graphql-gaps.md §6): if it turns out to EXCLUDE
 * already-assigned devices, this preview reads "devices the rule would add"
 * rather than "devices the rule targets", and re-editing an existing rule
 * under-reports. It is still the closest match available — the top-level
 * `devices` query is not platform-scoped, so it would over-report instead.
 *
 * Nothing commits as you type. A rule is a single value the server replaces
 * whole, and applying it re-points the schedule at a live set, so it goes
 * behind the page's explicit Save.
 */
function ScheduleCriteriaPicker({ scheduleId, criteria, onCriteriaChange, busy }: ScheduleCriteriaPickerProps) {
  const filter = useMemo(() => criteriaToFilter(criteria), [criteria]);
  // Editing the rule changes the preview's query variables. Deferring them
  // re-reads inside a transition, so the previous matches stay on screen
  // instead of the card dropping to its Suspense fallback on every click.
  const { deferredFilters: deferredFilter } = useDeferredQuery(filter, '');

  const data = useLazyLoadQuery<AvailableQueryType>(
    scheduleDevicePickerRelayQuery,
    { scheduleId, filter: toRelayFilter(deferredFilter), search: null, first: PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const preview = usePaginationFragment<AvailablePaginationQueryType, AvailableFragmentKey>(
    scheduleDevicePickerRelayFragment,
    data,
  );
  const connection = (preview.data as AvailableFragmentData | null)?.availableDevicesForSchedule;
  const rows = useMemo(() => toDevices(connection?.edges), [connection?.edges]);

  const loadMore = useCallback(() => {
    if (preview.hasNext && !preview.isLoadingNext) preview.loadNext(PAGE_SIZE);
  }, [preview]);

  const { data: filterOptions } = useDeviceFilters(UNFILTERED);

  return (
    <DeviceSelector
      devices={rows}
      loading={false}
      disabled={busy}
      // The radio lives on the page; this only tells the picker to render as the
      // criteria surface — no card, no toolbar, no row actions.
      selectionMode="criteria"
      showSelectionModeRadio={false}
      totalCount={connection?.filteredCount ?? undefined}
      infiniteScroll={{
        hasNextPage: preview.hasNext,
        isFetchingNextPage: preview.isLoadingNext,
        onLoadMore: loadMore,
        skeletonRows: 2,
      }}
      criteriaContent={
        <ScheduleCriteriaFields
          criteria={criteria}
          onChange={onCriteriaChange}
          deviceFilters={filterOptions}
          disabled={busy}
        />
      }
    />
  );
}

/**
 * The real picker in its loading state, so there is no separate skeleton to
 * drift.
 *
 * It takes the mode because the two halves are different surfaces — a card with
 * a tab strip and a search row versus bare fields over a preview. A switch
 * commits before its data arrives, so a skeleton of the half being LEFT would
 * be the wrong shape, and the layout would jump again the moment the real half
 * landed.
 */
function SchedulePickerSkeleton({ mode }: { mode: DeviceSelectionMode }) {
  return (
    <DeviceSelector
      devices={[]}
      loading
      readOnly
      selectionMode={mode}
      criteriaContent={mode === 'criteria' ? <ScheduleCriteriaFieldsSkeleton /> : undefined}
    />
  );
}

/** The schedule's own row above the editor — page-level, so mode switches never redraw it. */
function SchedulePickerHeader({ schedule }: { schedule: ScheduleDetailData | undefined }) {
  const { date, time } = formatScheduleStartAt(schedule?.startAt);
  if (!schedule) return <ScheduleInfoBarSkeleton />;
  return (
    <ScheduleInfoBarFromData
      name={schedule.name}
      note={schedule.description ?? ''}
      date={date}
      time={time}
      repeat={repeatToLabel(schedule.repeat)}
      platforms={platformsToIds(schedule.supportedPlatforms)}
      trigger={schedule.trigger}
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

  // Mode and rule are DERIVED from the schedule until the user touches them, so
  // the page renders the stored answer the moment the gate delivers it — no
  // seeding effect, and no flash of the specific picker on a criteria schedule.
  const [modeOverride, setModeOverride] = useState<DeviceSelectionMode | null>(null);
  const [criteriaDraft, setCriteriaDraft] = useState<ScheduleCriteria | null>(null);

  const storedMode: DeviceSelectionMode =
    schedule?.selectionMode === ScheduleDeviceSelectionMode.CRITERIA ? 'criteria' : 'specific';
  const storedCriteria = useMemo(() => criteriaFromStored(schedule?.deviceCriteria), [schedule?.deviceCriteria]);
  const selectionMode = modeOverride ?? storedMode;
  const criteria = criteriaDraft ?? storedCriteria;

  const debouncedSearch = useDebounce(search, 300);
  const filter = useMemo(() => narrowingToFilter(narrowing), [narrowing]);
  const { deferredFilters: deferredFilter, deferredSearch } = useDeferredQuery(filter, debouncedSearch);

  const [commitAdd, isAdding] = useMutation<AddDevicesMutationType>(addDevicesToScheduleMutation);
  const [commitRemove, isRemoving] = useMutation<RemoveDevicesMutationType>(removeDevicesFromScheduleMutation);
  const [commitAddAll, isAddingAll] = useMutation<AddAllDevicesMutationType>(addAllDevicesToScheduleMutation);
  const [commitRemoveAll, isRemovingAll] = useMutation<RemoveAllDevicesMutationType>(
    removeAllDevicesFromScheduleMutation,
  );
  const [commitSetCriteria, isSavingCriteria] = useMutation<SetCriteriaMutationType>(setScheduleDeviceCriteriaMutation);
  const busy = isAdding || isRemoving || isAddingAll || isRemovingAll || isSavingCriteria;

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
      onCompleted: response => {
        toast({
          title: 'Devices assigned',
          description: `This schedule now runs on ${response.addAllDevicesToSchedule.deviceCount} device(s).`,
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
      onCompleted: response => {
        toast({
          title: 'Devices unassigned',
          description: `This schedule now runs on ${response.removeAllDevicesFromSchedule.deviceCount} device(s).`,
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

  // Deliberately NOT a transition. Both halves read their own query, so a
  // transition would hold the old half — radio included — on screen until the
  // new one's request came back, and the click would look ignored for as long
  // as the backend took. The radio is a mode switch, not a navigation: it
  // commits at once, and the half underneath falls to its skeleton while its
  // devices load.
  const handleModeChange = useCallback((mode: DeviceSelectionMode) => {
    setModeOverride(mode);
  }, []);

  const goBackToSchedule = useCallback(
    () => safeBackOrReplace(router, routes.scriptsV2.schedules.details(scheduleId, { tab: 'devices' })),
    [router, scheduleId],
  );

  const handleSaveCriteria = useCallback(() => {
    commitSetCriteria({
      variables: { scheduleId, criteria: toRelayCriteria(criteria) },
      onCompleted: () => {
        toast({
          title: 'Criteria saved',
          description: 'This schedule now targets every device matching the criteria, including future ones.',
          variant: 'success',
        });
        goBackToSchedule();
      },
      onError: errorHandler('Failed to save device criteria'),
    });
  }, [commitSetCriteria, scheduleId, criteria, toast, goBackToSchedule, errorHandler]);

  // The two modes genuinely differ in what "finish" means. Specific commits each
  // +/- as it happens, so there is nothing left to save and the action just
  // leaves. A rule is one value replaced wholesale — and applying it re-points
  // the schedule at a live set — so it needs a deliberate Save (labelled as the
  // design has it, 460:85294), and stays enabled even when unchanged: on a
  // schedule that is still SPECIFIC, saving an untouched rule IS the change.
  const actions = useMemo<PageActionButton[]>(() => {
    if (selectionMode === 'criteria') {
      return [
        {
          label: isSavingCriteria ? 'Saving...' : 'Save Devices',
          onClick: handleSaveCriteria,
          variant: 'accent' as const,
          disabled: busy || (storedMode === 'criteria' && criteriaEqual(criteria, storedCriteria)),
        },
      ];
    }
    return [{ label: 'Done', onClick: goBackToSchedule, variant: 'accent' as const, disabled: busy }];
  }, [
    selectionMode,
    isSavingCriteria,
    handleSaveCriteria,
    busy,
    storedMode,
    criteria,
    storedCriteria,
    goBackToSchedule,
  ]);

  return (
    <ScriptPageChrome
      title="Schedule Devices"
      backFallback={routes.scriptsV2.schedules.details(scheduleId)}
      actionsVariant="primary-buttons"
      showMobileCancel
      actions={actions}
    >
      {/* The info bar and the radio are rendered HERE, not inside the halves.
          Each mode is its own data island, so switching unmounts one subtree and
          mounts the other; anything drawn inside goes with it, and a remounted
          radio restarts its own transitions — the control you just clicked
          blinks. Above the swap, it simply stays put. */}
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <SchedulePickerHeader schedule={schedule} />

        <DeviceSelectionModeRadio value={selectionMode} onChange={handleModeChange} disabled={busy} />

        {/* Which half to render is the schedule's own answer, so nothing is
            rendered until it arrives: mounting the specific picker on a guess
            would fire its two queries and then throw them away the moment a
            CRITERIA schedule landed. On the path users actually take — in from
            the details page — the store is warm and the gate seeds before the
            first paint, so this branch costs nothing.

            The fallback reads the LIVE mode, not a deferred one: the switch
            commits immediately, so by the time this boundary suspends
            `selectionMode` already names the half being loaded.

            The keyed wrapper is what replays the enter animation. Here it earns
            its place — the half arrives where a skeleton was, so the fade covers
            an appearance rather than blanking content that was already
            readable, which is why the tab bodies have none. */}
        <Suspense fallback={<SchedulePickerSkeleton mode={selectionMode} />}>
          <div key={schedule ? selectionMode : 'pending'} className={CONTENT_SWAP_ANIMATION}>
            {!schedule ? (
              <SchedulePickerSkeleton mode={selectionMode} />
            ) : selectionMode === 'criteria' ? (
              <ScheduleCriteriaPicker
                scheduleId={scheduleId}
                criteria={criteria}
                onCriteriaChange={setCriteriaDraft}
                busy={busy}
              />
            ) : (
              <SchedulePickerLists
                scheduleId={scheduleId}
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
            )}
          </div>
        </Suspense>
      </div>
    </ScriptPageChrome>
  );
}

interface ScheduleDevicesViewProps {
  scheduleId: string;
}

/**
 * "Edit Devices" for a schedule (v2, Relay).
 *
 * Two ways to target devices, chosen by the mode radio and backed by different
 * write models:
 *
 * - **Specific** — an explicit machine set, edited incrementally (below).
 * - **By criteria** — a stored rule (customer / type / OS) the server resolves
 *   live, so devices registered later that match are targeted without anyone
 *   editing the schedule. One value, committed behind an explicit Save.
 *
 * In specific mode, every +/− commits the moment it is clicked, through the incremental
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
