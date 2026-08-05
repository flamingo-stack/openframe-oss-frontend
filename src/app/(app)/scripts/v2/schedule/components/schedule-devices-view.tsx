'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptScheduleDevicesSettingsRelayQuery as ScheduleDevicesSettingsQueryType } from '@/__generated__/scriptScheduleDevicesSettingsRelayQuery.graphql';
import { DeviceSelectionModeRadio } from '@/app/components/shared/device-selector';
import type {
  DeviceSelectionMode,
  DeviceSelectorNarrowing,
  SubTab,
} from '@/app/components/shared/device-selector/device-selector.types';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { safeBackOrReplace, useSafeBack } from '@/app/hooks/use-safe-back';
import { ScheduleDeviceSelectionMode } from '@/generated/schema-enums';
import { scriptScheduleDevicesSettingsRelayQuery } from '@/graphql/scripts/script-schedule-devices-settings-relay';
import { routes } from '@/lib/routes';
import { ScheduleInfoBarFromData } from '../../../components/schedule/schedule-info-bar';
import { platformsToIds } from '../../shared/utils/script-mappers';
import { useScheduleDeviceAssignment } from '../hooks/use-schedule-device-assignment';
import { useScheduleSelectionMode } from '../hooks/use-schedule-selection-mode';
import { criteriaEqual, criteriaFromStored, type ScheduleCriteria } from '../utils/schedule-criteria';
import { EMPTY_NARROWING, narrowingToFilter } from '../utils/schedule-device-filters';
import { formatScheduleStartAt, repeatToLabel } from '../utils/schedule-timing';
import { ScheduleCriteriaPicker } from './schedule-criteria-picker';
import { SchedulePickerSkeleton } from './schedule-devices-skeleton';
import { SchedulePickerLists } from './schedule-picker-lists';

interface ScheduleDevicesViewProps {
  scheduleId: string;
}

/**
 * "Edit Devices" for a schedule (v2, Relay).
 *
 * Two ways to target devices, chosen by the mode radio and backed by different
 * write models:
 *
 * - **Specific** — an explicit machine set, edited incrementally: every +/−
 *   commits the moment it is clicked, through the incremental
 *   `addDevicesToSchedule` / `removeDevicesFromSchedule` pair and their bulk
 *   counterparts — which is why the page exits via Done rather than Save. That
 *   is not a style choice. The previous `setScriptScheduleDevices` took the
 *   WHOLE machine set and overwrote the assignment with it, so the editor had to
 *   hold the entire assignment in memory or delete the part it had never read;
 *   it could not, once an assignment outgrew the single page it fetched. Both
 *   lists and both bulk actions are resolved server-side now.
 * - **By criteria** — a stored rule (customer / type / OS) the server resolves
 *   live, so devices registered later that match are targeted without anyone
 *   editing the schedule. One value, committed behind an explicit Save.
 *
 * The MODE itself is a third write, and it follows whichever half it selects.
 * Into CRITERIA it rides `setScheduleDeviceCriteria`, behind that half's Save,
 * because it needs the rule. Into SPECIFIC it commits **on the click**, through
 * `selectionMode` on the schedule's update input (see
 * `useScheduleSelectionMode`) — that half commits everything as it happens, and
 * more importantly the mode is what the server's per-row `assigned` flag means:
 * until it lands, the flag answers "matches the rule", and the list would
 * pre-check rows that are not in the explicit assignment at all.
 *
 * Suspends on the SETTINGS query — a small read of the mode, the rule and the
 * info bar's fields — so the picker's own (heavy) device query loads under a
 * page that is already drawn. The route renders `ScheduleDevicesSkeleton` while
 * the settings are in flight.
 */
export function ScheduleDevicesView({ scheduleId }: ScheduleDevicesViewProps) {
  const router = useRouter();
  // The SETTINGS query, not the full schedule: this page branches on
  // `selectionMode`, and the detail query would make that answer wait behind the
  // source of every script the schedule runs. The devices are a query of their
  // own, issued by whichever half this resolves to.
  const data = useLazyLoadQuery<ScheduleDevicesSettingsQueryType>(
    scriptScheduleDevicesSettingsRelayQuery,
    { id: scheduleId },
    { fetchPolicy: 'store-and-network' },
  );
  const schedule = data.scriptSchedule;

  const [activeTab, setActiveTab] = useState<SubTab>('available');
  const [search, setSearch] = useState('');
  const [narrowing, setNarrowing] = useState<DeviceSelectorNarrowing>(EMPTY_NARROWING);

  // Mode and rule are DERIVED from the schedule until the user touches them, so
  // the page renders the stored answer as soon as the query lands — no seeding
  // effect, and no flash of the specific picker on a criteria schedule.
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

  const {
    busy: assignmentBusy,
    isSavingCriteria,
    addDevice,
    removeDevice,
    addAllDevices,
    removeAllDevices,
    saveCriteria,
    refreshLists,
  } = useScheduleDeviceAssignment({
    scheduleId,
    filter,
    search: debouncedSearch,
    deferredFilter,
    deferredSearch,
  });

  // The other direction of the mode switch — see the hook for why it goes
  // through the schedule's full update rather than a mutation of its own.
  const { saveSpecificMode, isSavingMode } = useScheduleSelectionMode(schedule);
  const busy = assignmentBusy || isSavingMode;

  // What locks the MODE radio, and it is a shorter list than `busy` on purpose.
  // Only the two writes that set `selectionMode` itself belong here — saving the
  // rule (which flips to CRITERIA) and the switch to SPECIFIC — because letting
  // a second one start mid-flight is a race for one field, with the winner
  // decided by whichever response lands last.
  //
  // "Add All" / "Remove All" are NOT that. They edit the membership of a mode
  // that is already set, they resolve their set server-side, and on a real fleet
  // they take a while — locking the radio there strands the user in a half they
  // may have opened by mistake, with nothing to do but wait.
  const isSavingTargetingMode = isSavingCriteria || isSavingMode;

  const handleBack = useSafeBack(routes.scriptsV2.schedules.details(scheduleId));

  const goBackToSchedule = useCallback(
    () => safeBackOrReplace(router, routes.scriptsV2.schedules.details(scheduleId, { tab: 'devices' })),
    [router, scheduleId],
  );

  // Each tab narrows its own list, and carrying one tab's search into the other
  // would silently hide rows the user never filtered.
  const handleTabChange = useCallback((tab: SubTab) => {
    setActiveTab(tab);
    setSearch('');
    setNarrowing(EMPTY_NARROWING);
  }, []);

  // Deliberately NOT a transition. Both halves read their own query, so a
  // transition would hold the old half — radio included — on screen until the
  // new one's request came back, and the click would look ignored for as long as
  // the backend took. The radio is a mode switch, not a navigation: it commits
  // at once, and the half underneath falls to its skeleton while its devices
  // load.
  //
  // The narrowing is dropped with the switch, for the same reason a tab switch
  // drops it — and here it matters more, because the criteria half renders
  // NEITHER the search box nor the funnels. A search typed in the specific half
  // survives a trip through criteria invisibly, and coming back the user is
  // looking at a shortened list of "all devices" with nothing on screen to
  // explain it. Each half opens the way it does on a fresh visit.
  //
  // Picking SPECIFIC also WRITES, straight away. The mode decides what the
  // server means by each row's `assigned` flag: while the schedule is still
  // stored as CRITERIA it answers "this device matches the rule", so the
  // specific list would pre-check rows that are not in the explicit assignment —
  // and a click on one of them would read as "remove" when the user meant "add".
  // Committing first makes the list that follows describe the explicit
  // assignment, which is the thing being edited. `refreshLists` then re-reads
  // what is already mounted; the invalidation inside the mutation only governs
  // reads that start later.
  //
  // The other direction is not symmetrical, and shouldn't be: CRITERIA needs the
  // rule, which the user is still writing, so it stays behind Save Devices.
  const handleModeChange = useCallback(
    (mode: DeviceSelectionMode) => {
      setModeOverride(mode);
      setActiveTab('available');
      setSearch('');
      setNarrowing(EMPTY_NARROWING);

      if (mode !== 'specific' || storedMode !== 'criteria') return;
      saveSpecificMode({
        // The stored mode now says SPECIFIC on its own, so the local override has
        // nothing left to override.
        onSaved: () => {
          setModeOverride(null);
          refreshLists();
        },
        // The write failed: the radio goes back to what the schedule actually
        // is, rather than leaving the user editing a list that isn't in effect.
        onFailed: () => setModeOverride(null),
      });
    },
    [storedMode, saveSpecificMode, refreshLists],
  );

  const handleSaveCriteria = useCallback(
    () => saveCriteria(criteria, goBackToSchedule),
    [saveCriteria, criteria, goBackToSchedule],
  );

  // The two modes genuinely differ in what "finish" means. Specific commits each
  // +/− as it happens, so there is nothing left to save and the action just
  // leaves. A rule is one value replaced wholesale — and applying it re-points
  // the schedule at a live set — so it needs a deliberate Save (labelled as the
  // design has it, 460:85294), and stays enabled even when unchanged: on a
  // schedule that is still SPECIFIC, saving an untouched rule IS the change.
  const actions = useMemo<PageActionButton[]>(() => {
    // The finish button is the only other action, so on a phone the bar would be
    // one full-width button with the way out off-screen at the top of the page —
    // hence the mobile-only Cancel, which IS the Back navigation.
    const cancel: PageActionButton = {
      label: 'Cancel',
      onClick: handleBack,
      variant: 'outline' as const,
      showOnlyMobile: true,
    };

    if (selectionMode === 'criteria') {
      return [
        cancel,
        {
          label: isSavingCriteria ? 'Saving...' : 'Save Devices',
          onClick: handleSaveCriteria,
          variant: 'accent' as const,
          disabled: busy || (storedMode === 'criteria' && criteriaEqual(criteria, storedCriteria)),
        },
      ];
    }
    // The specific half has nothing left to save in EITHER case now: its +/−
    // clicks commit as they happen, and the mode itself was written the moment
    // the radio moved (see `handleModeChange`).
    return [cancel, { label: 'Done', onClick: goBackToSchedule, variant: 'accent' as const, disabled: busy }];
  }, [
    selectionMode,
    isSavingCriteria,
    handleSaveCriteria,
    busy,
    storedMode,
    criteria,
    storedCriteria,
    goBackToSchedule,
    handleBack,
  ]);

  if (!schedule) {
    return <NotFoundError message="Schedule not found" />;
  }

  const { date, time } = formatScheduleStartAt(schedule.startAt);

  return (
    <PageLayout
      title="Schedule Devices"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {/* The info bar and the radio are rendered HERE, not inside the halves.
          Each mode is its own data island, so switching unmounts one subtree and
          mounts the other; anything drawn inside goes with it, and a remounted
          radio restarts its own transitions — the control you just clicked
          blinks. Above the swap, it simply stays put. */}
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <ScheduleInfoBarFromData
          name={schedule.name}
          note={schedule.description ?? ''}
          date={date}
          time={time}
          repeat={repeatToLabel(schedule.repeat)}
          platforms={platformsToIds(schedule.supportedPlatforms)}
          trigger={schedule.trigger}
        />

        <DeviceSelectionModeRadio value={selectionMode} onChange={handleModeChange} disabled={isSavingTargetingMode} />

        {/* The fallback reads the LIVE mode, not a deferred one: the switch
            commits immediately, so by the time this boundary suspends
            `selectionMode` already names the half being loaded.

            No enter animation on the swap. The radio is a control, not a
            navigation: the answer belongs under the finger that asked for it,
            and a fade — however light — is time between the click and the
            readable half. Each branch is its own component type, so React
            replaces the subtree on its own; there is no wrapper to key. */}
        <Suspense fallback={<SchedulePickerSkeleton mode={selectionMode} />}>
          {selectionMode === 'criteria' ? (
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
              deferredFilter={deferredFilter}
              deferredSearch={deferredSearch}
              busy={busy}
              onAdd={addDevice}
              onRemove={removeDevice}
              onAddAll={addAllDevices}
              onRemoveAll={removeAllDevices}
            />
          )}
        </Suspense>
      </div>
    </PageLayout>
  );
}
