'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef } from 'react';
import { fetchQuery, useMutation, useRelayEnvironment } from 'react-relay';
import type { addAllDevicesToScheduleMutation as AddAllDevicesMutationType } from '@/__generated__/addAllDevicesToScheduleMutation.graphql';
import type { addDevicesToScheduleMutation as AddDevicesMutationType } from '@/__generated__/addDevicesToScheduleMutation.graphql';
import type { removeAllDevicesFromScheduleMutation as RemoveAllDevicesMutationType } from '@/__generated__/removeAllDevicesFromScheduleMutation.graphql';
import type { removeDevicesFromScheduleMutation as RemoveDevicesMutationType } from '@/__generated__/removeDevicesFromScheduleMutation.graphql';
import type { setScheduleDeviceCriteriaMutation as SetCriteriaMutationType } from '@/__generated__/setScheduleDeviceCriteriaMutation.graphql';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { addAllDevicesToScheduleMutation } from '@/graphql/scripts/add-all-devices-to-schedule-mutation';
import { addDevicesToScheduleMutation } from '@/graphql/scripts/add-devices-to-schedule-mutation';
import { removeAllDevicesFromScheduleMutation } from '@/graphql/scripts/remove-all-devices-from-schedule-mutation';
import { removeDevicesFromScheduleMutation } from '@/graphql/scripts/remove-devices-from-schedule-mutation';
import {
  scheduleDevicePickerRelayAssignedQuery,
  scheduleDevicePickerRelayQuery,
} from '@/graphql/scripts/schedule-device-picker-relay';
import { setScheduleDeviceCriteriaMutation } from '@/graphql/scripts/set-schedule-device-criteria-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { assignmentUpdaters, type ConnectionNarrowing } from '../utils/schedule-assignment-updaters';
import type { ScheduleCriteria } from '../utils/schedule-criteria';
import { DEVICE_PICKER_PAGE_SIZE, toRelayCriteria, toRelayFilter } from '../utils/schedule-device-filters';

interface UseScheduleDeviceAssignmentOptions {
  scheduleId: string;
  /** Live narrowing — what the user is looking at right now. */
  filter: DeviceFilterInput;
  search: string;
  /** Deferred narrowing — what the mounted picker queries were actually read with. */
  deferredFilter: DeviceFilterInput;
  deferredSearch: string;
}

/**
 * Every write the device picker performs, and the toast each owes the user.
 *
 * The two write models differ on purpose. A single +/− is committed
 * incrementally and rendered straight from the Relay store; the bulk actions and
 * the criteria save replace the assignment wholesale, so they report `busy` and
 * re-read from the network.
 */
export function useScheduleDeviceAssignment({
  scheduleId,
  filter,
  search,
  deferredFilter,
  deferredSearch,
}: UseScheduleDeviceAssignmentOptions) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();

  // No in-flight flag for the single-row pair: the optimistic layer is their
  // state, per row, and a global one would only re-lock what it replaced.
  const [commitAdd] = useMutation<AddDevicesMutationType>(addDevicesToScheduleMutation);
  const [commitRemove] = useMutation<RemoveDevicesMutationType>(removeDevicesFromScheduleMutation);
  const [commitAddAll, isAddingAll] = useMutation<AddAllDevicesMutationType>(addAllDevicesToScheduleMutation);
  const [commitRemoveAll, isRemovingAll] = useMutation<RemoveAllDevicesMutationType>(
    removeAllDevicesFromScheduleMutation,
  );
  const [commitSetCriteria, isSavingCriteria] = useMutation<SetCriteriaMutationType>(setScheduleDeviceCriteriaMutation);

  // Only the wholesale writes lock the editor. "Add All" / "Remove All" replace
  // the list under the user and the criteria save navigates away, so letting a
  // second click land mid-flight would act on a list that is about to be
  // replaced. A single +/− is scoped to its own row and shows optimistically —
  // disabling the page for it made every click feel like a page load.
  const busy = isAddingAll || isRemovingAll || isSavingCriteria;

  // The bulk actions must send the narrowing as it is AT CLICK TIME; a ref keeps
  // the handlers reference-stable so the memoized rows don't re-render on every
  // keystroke in the search box.
  //
  // Written in an effect, not in render: a render React replays or throws away
  // would otherwise publish a narrowing no committed UI is showing, and a bulk
  // click landing in that window would act on a filter the user cannot see. An
  // effect can only run for a render that committed — which is also exactly the
  // "at click time" value, since a click can only follow a commit.
  const narrowingRef = useRef({ filter, search });
  useEffect(() => {
    narrowingRef.current = { filter, search };
  }, [filter, search]);

  // Both the store patches and the refresh must name the narrowing the mounted
  // queries were READ with — the deferred one, which is what their connection
  // records are keyed by. It differs from the live pair only while a narrowing
  // transition is in flight, but on that frame writing against the live values
  // would touch a connection nothing on screen is subscribed to, and the change
  // would land invisibly.
  const queryVarsRef = useRef({ filter: deferredFilter, search: deferredSearch });
  useEffect(() => {
    queryVarsRef.current = { filter: deferredFilter, search: deferredSearch };
  }, [deferredFilter, deferredSearch]);

  const connectionNarrowing = useCallback((): ConnectionNarrowing => {
    const { filter: f, search: term } = queryVarsRef.current;
    return { filter: toRelayFilter(f), search: term || null };
  }, []);

  const errorHandler = useCallback(
    (fallback: string) => (error: Error) => {
      toast({ title: 'Error', description: getRelayErrorMessage(error, fallback), variant: 'destructive' });
    },
    [toast],
  );

  /**
   * Re-reads both halves from the network.
   *
   * For the writes whose result the client cannot work out: the BULK actions,
   * which replace the assignment wholesale against a filter the server resolves,
   * and the MODE switch, which changes what the per-row `assigned` flag even
   * means (rule membership vs the explicit list). A single +/− needs none of it —
   * it changes exactly one row and one number, and both are written into the
   * store directly.
   */
  const refreshLists = useCallback(() => {
    const variables = { scheduleId, ...connectionNarrowing(), first: DEVICE_PICKER_PAGE_SIZE, after: null };
    // Both halves report their own failure, and they have to. The mutation that
    // called this one has already toasted its success, and these re-reads are the
    // only thing that puts the new assignment on screen — so a failure swallowed
    // here leaves the user looking at the PREVIOUS lists having just been told
    // the new ones were saved.
    const onError = errorHandler('Devices were saved, but the lists could not be refreshed');
    fetchQuery(environment, scheduleDevicePickerRelayQuery, variables, { fetchPolicy: 'network-only' }).subscribe({
      error: onError,
    });
    fetchQuery(environment, scheduleDevicePickerRelayAssignedQuery, variables, {
      fetchPolicy: 'network-only',
    }).subscribe({ error: onError });
  }, [environment, scheduleId, connectionNarrowing, errorHandler]);

  // Both single-row handlers render the change once, in the optimistic layer,
  // and never again: the same patch is re-applied on the real commit, so the
  // data the response settles on is the data already on screen and Relay's
  // snapshot comparison finds nothing to re-render. Nothing is refetched — a
  // re-read would republish every node on the page, and one whose `lastSeen`
  // has ticked over since is a changed record, which is a second render of the
  // whole table for no new information.
  //
  // A failure needs no rollback either: Relay drops the layer, and the row and
  // the count go back to what the server last said.
  const addDevice = useCallback(
    (device: Device) => {
      commitAdd({
        variables: { scheduleId, machineIds: [device.id] },
        ...assignmentUpdaters(scheduleId, device.id, true, connectionNarrowing()),
        onCompleted: () => {
          toast({
            title: 'Device assigned',
            description: `"${device.displayName || device.hostname}" was added to this schedule.`,
            variant: 'success',
          });
        },
        onError: errorHandler('Failed to assign device'),
      });
    },
    [commitAdd, scheduleId, toast, errorHandler, connectionNarrowing],
  );

  const removeDevice = useCallback(
    (device: Device) => {
      commitRemove({
        variables: { scheduleId, machineIds: [device.id] },
        ...assignmentUpdaters(scheduleId, device.id, false, connectionNarrowing()),
        onCompleted: () => {
          toast({
            title: 'Device unassigned',
            description: `"${device.displayName || device.hostname}" was removed from this schedule.`,
            variant: 'success',
          });
        },
        onError: errorHandler('Failed to unassign device'),
      });
    },
    [commitRemove, scheduleId, toast, errorHandler, connectionNarrowing],
  );

  const addAllDevices = useCallback(() => {
    const { filter: f, search: s } = narrowingRef.current;
    commitAddAll({
      variables: { scheduleId, filter: toRelayFilter(f), search: s || null },
      onCompleted: response => {
        toast({
          title: 'Devices assigned',
          description: `This schedule now runs on ${response.addAllDevicesToSchedule.deviceCount} device(s).`,
          variant: 'success',
        });
        refreshLists();
      },
      onError: errorHandler('Failed to assign devices'),
    });
  }, [commitAddAll, scheduleId, toast, refreshLists, errorHandler]);

  const removeAllDevices = useCallback(() => {
    const { filter: f, search: s } = narrowingRef.current;
    commitRemoveAll({
      variables: { scheduleId, filter: toRelayFilter(f), search: s || null },
      onCompleted: response => {
        toast({
          title: 'Devices unassigned',
          description: `This schedule now runs on ${response.removeAllDevicesFromSchedule.deviceCount} device(s).`,
          variant: 'success',
        });
        refreshLists();
      },
      onError: errorHandler('Failed to unassign devices'),
    });
  }, [commitRemoveAll, scheduleId, toast, refreshLists, errorHandler]);

  const saveCriteria = useCallback(
    (criteria: ScheduleCriteria, onSaved: () => void) => {
      commitSetCriteria({
        variables: { scheduleId, criteria: toRelayCriteria(criteria) },
        // A new rule re-points the schedule at a different SET of machines, and
        // the payload cannot say which: it carries the rule and the count, not
        // the members. Every `assignedDevices` connection already in the store —
        // this page's two, the details tab's, one per narrowing each — is
        // therefore stale, and none of them can be patched from what came back.
        //
        // Invalidating the schedule record marks all of them unusable at once,
        // so the next read of any of them goes to the network instead of
        // rendering the previous rule's machines. Without it the details tab
        // shows the OLD devices: it reads `store-and-network`, so the stale
        // store answer is what it paints while the request is in flight — and on
        // a back navigation that restores the tab, that is the whole render.
        updater: store => {
          store.get(scheduleId)?.invalidateRecord();
        },
        onCompleted: () => {
          toast({
            title: 'Criteria saved',
            description: 'This schedule now targets every device matching the criteria, including future ones.',
            variant: 'success',
          });
          onSaved();
        },
        onError: errorHandler('Failed to save device criteria'),
      });
    },
    [commitSetCriteria, scheduleId, toast, errorHandler],
  );

  return {
    busy,
    isSavingCriteria,
    addDevice,
    removeDevice,
    addAllDevices,
    removeAllDevices,
    saveCriteria,
    refreshLists,
  };
}
