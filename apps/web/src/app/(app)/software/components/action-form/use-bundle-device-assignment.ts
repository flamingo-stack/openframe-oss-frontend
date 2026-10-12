'use client';

import { type DeviceFilterInput, getDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef } from 'react';
import { fetchQuery, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useBundleDeviceAssignmentAddAllMutation as AddAllMutationType } from '@/__generated__/useBundleDeviceAssignmentAddAllMutation.graphql';
import type { useBundleDeviceAssignmentAddMutation as AddMutationType } from '@/__generated__/useBundleDeviceAssignmentAddMutation.graphql';
import type { useBundleDeviceAssignmentRemoveAllMutation as RemoveAllMutationType } from '@/__generated__/useBundleDeviceAssignmentRemoveAllMutation.graphql';
import type { useBundleDeviceAssignmentRemoveMutation as RemoveMutationType } from '@/__generated__/useBundleDeviceAssignmentRemoveMutation.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import {
  assignmentUpdaters,
  type ConnectionNarrowing,
} from '@/app/components/shared/device-selector/assignment-updaters';
import { DEVICE_PICKER_PAGE_SIZE } from '@/app/components/shared/device-selector/picker-narrowing';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { pluralize } from '@/lib/pluralize';
import {
  BUNDLE_PICKER_CONNECTION_KEYS,
  bundlePickerListsAssignedQuery,
  bundlePickerListsAvailableQuery,
} from './bundle-picker-lists';

/**
 * The single-row pair reads back `id` alone: `deviceCount` is moved by a delta
 * in the store (`assignmentUpdaters`), because an ABSOLUTE count in the payload
 * lets two clicks whose responses cross settle on the older snapshot.
 */
const addMutation = graphql`
  mutation useBundleDeviceAssignmentAddMutation($bundleId: ID!, $machineIds: [ID!]!) {
    addDevicesToSoftwareBundle(bundleId: $bundleId, machineIds: $machineIds) {
      id
    }
  }
`;

const removeMutation = graphql`
  mutation useBundleDeviceAssignmentRemoveMutation($bundleId: ID!, $machineIds: [ID!]!) {
    removeDevicesFromSoftwareBundle(bundleId: $bundleId, machineIds: $machineIds) {
      id
    }
  }
`;

/**
 * "Add All Devices" — everything matching the Available list's CURRENT filter
 * and search, resolved on the server. The client has only paged in part of the
 * candidate list, so a client-assembled set would quietly mean "add all the
 * ones I happen to have scrolled past".
 */
const addAllMutation = graphql`
  mutation useBundleDeviceAssignmentAddAllMutation($bundleId: ID!, $filter: DeviceFilterInput, $search: String) {
    addAllDevicesToSoftwareBundle(bundleId: $bundleId, filter: $filter, search: $search) {
      id
      deviceCount
    }
  }
`;

const removeAllMutation = graphql`
  mutation useBundleDeviceAssignmentRemoveAllMutation($bundleId: ID!, $filter: DeviceFilterInput, $search: String) {
    removeAllDevicesFromSoftwareBundle(bundleId: $bundleId, filter: $filter, search: $search) {
      id
      deviceCount
    }
  }
`;

interface UseBundleDeviceAssignmentOptions {
  /** The draft — opened with the form (`useDraftBundle`), so every write has one to target. */
  bundleId: string;
  /** Live narrowing — what the user is looking at right now. */
  filter: DeviceFilterInput;
  search: string;
  /** Deferred narrowing — what the mounted picker queries were actually read with. */
  deferredFilter: DeviceFilterInput;
  deferredSearch: string;
}

/**
 * Every write the bundle's device picker performs, and the toast each owes the
 * user — the same two write models as a script schedule's picker
 * (`useScheduleDeviceAssignment`): a single +/− is committed incrementally and
 * rendered straight from the Relay store; the bulk actions replace the
 * assignment wholesale, so they report `busy` and re-read from the network.
 */
export function useBundleDeviceAssignment({
  bundleId,
  filter,
  search,
  deferredFilter,
  deferredSearch,
}: UseBundleDeviceAssignmentOptions) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();

  const [commitAdd] = useMutation<AddMutationType>(addMutation);
  const [commitRemove] = useMutation<RemoveMutationType>(removeMutation);
  const [commitAddAll, isAddingAll] = useMutation<AddAllMutationType>(addAllMutation);
  const [commitRemoveAll, isRemovingAll] = useMutation<RemoveAllMutationType>(removeAllMutation);

  // Only the wholesale writes lock the picker — they replace the list under the user.
  const busy = isAddingAll || isRemovingAll;
  // The handlers' own check, not just the picker's: a row that has not
  // re-rendered since the lock went on can still deliver a click.
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // No in-flight STATE for the single-row pair: the optimistic layer is their
  // state, per row — the click flips the row at once, and nothing else is drawn.
  // Only a guard: until a row's write lands, a further click on that row is
  // dropped, so it can neither resend the add nor race it with a remove the
  // server may apply first.
  const inFlightRef = useRef(new Set<string>());
  const setInFlight = useCallback((deviceId: string, inFlight: boolean) => {
    if (inFlight) inFlightRef.current.add(deviceId);
    else inFlightRef.current.delete(deviceId);
  }, []);

  // The bulk actions must send the narrowing as it is AT CLICK TIME; a ref keeps
  // the handlers reference-stable. Written in an effect, not in render, so only
  // a committed narrowing — one the user can see — is ever published.
  const narrowingRef = useRef({ filter, search });
  useEffect(() => {
    narrowingRef.current = { filter, search };
  }, [filter, search]);

  // The store patches and the refresh must name the narrowing the mounted
  // queries were READ with — the deferred one, which is what their connection
  // records are keyed by.
  const queryVarsRef = useRef({ filter: deferredFilter, search: deferredSearch });
  useEffect(() => {
    queryVarsRef.current = { filter: deferredFilter, search: deferredSearch };
  }, [deferredFilter, deferredSearch]);

  const connectionNarrowing = useCallback((): ConnectionNarrowing => {
    const { filter: f, search: term } = queryVarsRef.current;
    return { filter: toRelayDeviceFilter(f), search: term || null };
  }, []);

  const errorHandler = useCallback(
    (fallback: string) => (error: Error) => {
      toast({ title: 'Error', description: getRelayErrorMessage(error, fallback), variant: 'destructive' });
    },
    [toast],
  );

  /**
   * Re-reads both halves from the network — for the bulk actions, whose result
   * the client cannot work out: they replace the assignment against a filter the
   * server resolves. Both halves report their own failure: the mutation has
   * already toasted its success, and these re-reads are the only thing that puts
   * the new assignment on screen.
   */
  const refreshLists = useCallback(
    (id: string) => {
      const variables = { bundleId: id, ...connectionNarrowing(), first: DEVICE_PICKER_PAGE_SIZE, after: null };
      const onError = errorHandler('Devices were saved, but the lists could not be refreshed');
      fetchQuery(environment, bundlePickerListsAvailableQuery, variables, { fetchPolicy: 'network-only' }).subscribe({
        error: onError,
      });
      fetchQuery(environment, bundlePickerListsAssignedQuery, variables, { fetchPolicy: 'network-only' }).subscribe({
        error: onError,
      });
    },
    [environment, connectionNarrowing, errorHandler],
  );

  // Both single-row handlers render the change once, in the optimistic layer,
  // and never again: the same patch is re-applied on the real commit. A failure
  // needs no rollback — Relay drops the layer, and the row and the count go back
  // to what the server last said.
  const addDevice = useCallback(
    (device: Device) => {
      if (busyRef.current || inFlightRef.current.has(device.id)) return;
      setInFlight(device.id, true);
      const onError = errorHandler('Failed to add the device');
      commitAdd({
        variables: { bundleId, machineIds: [device.id] },
        ...assignmentUpdaters(
          { id: bundleId, keys: BUNDLE_PICKER_CONNECTION_KEYS },
          device.id,
          true,
          connectionNarrowing(),
        ),
        onCompleted: () => {
          setInFlight(device.id, false);
          toast({
            title: 'Device added',
            description: `"${getDeviceName(device)}" was added to the selection.`,
            variant: 'success',
          });
        },
        onError: error => {
          setInFlight(device.id, false);
          onError(error);
        },
      });
    },
    [bundleId, commitAdd, connectionNarrowing, toast, errorHandler, setInFlight],
  );

  const removeDevice = useCallback(
    (device: Device) => {
      if (busyRef.current || inFlightRef.current.has(device.id)) return;
      setInFlight(device.id, true);
      const onError = errorHandler('Failed to remove the device');
      commitRemove({
        variables: { bundleId, machineIds: [device.id] },
        ...assignmentUpdaters(
          { id: bundleId, keys: BUNDLE_PICKER_CONNECTION_KEYS },
          device.id,
          false,
          connectionNarrowing(),
        ),
        onCompleted: () => {
          setInFlight(device.id, false);
          toast({
            title: 'Device removed',
            description: `"${getDeviceName(device)}" was removed from the selection.`,
            variant: 'success',
          });
        },
        onError: error => {
          setInFlight(device.id, false);
          onError(error);
        },
      });
    },
    [bundleId, commitRemove, connectionNarrowing, toast, errorHandler, setInFlight],
  );

  const addAllDevices = useCallback(() => {
    const { filter: f, search: s } = narrowingRef.current;
    commitAddAll({
      variables: { bundleId, filter: toRelayDeviceFilter(f), search: s || null },
      onCompleted: response => {
        toast({
          title: 'Devices added',
          description: `${pluralize(response.addAllDevicesToSoftwareBundle.deviceCount, 'device')} selected.`,
          variant: 'success',
        });
        refreshLists(bundleId);
      },
      onError: errorHandler('Failed to add the devices'),
    });
  }, [bundleId, commitAddAll, toast, refreshLists, errorHandler]);

  const removeAllDevices = useCallback(() => {
    const { filter: f, search: s } = narrowingRef.current;
    commitRemoveAll({
      variables: { bundleId, filter: toRelayDeviceFilter(f), search: s || null },
      onCompleted: response => {
        toast({
          title: 'Devices removed',
          description: `${pluralize(response.removeAllDevicesFromSoftwareBundle.deviceCount, 'device')} selected.`,
          variant: 'success',
        });
        refreshLists(bundleId);
      },
      onError: errorHandler('Failed to remove the devices'),
    });
  }, [bundleId, commitRemoveAll, toast, refreshLists, errorHandler]);

  return { busy, addDevice, removeDevice, addAllDevices, removeAllDevices };
}
