'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchQuery, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useBundleDeviceAssignmentAddAllMutation as AddAllMutationType } from '@/__generated__/useBundleDeviceAssignmentAddAllMutation.graphql';
import type { useBundleDeviceAssignmentAddMutation as AddMutationType } from '@/__generated__/useBundleDeviceAssignmentAddMutation.graphql';
import type { useBundleDeviceAssignmentRemoveAllMutation as RemoveAllMutationType } from '@/__generated__/useBundleDeviceAssignmentRemoveAllMutation.graphql';
import type { useBundleDeviceAssignmentRemoveMutation as RemoveMutationType } from '@/__generated__/useBundleDeviceAssignmentRemoveMutation.graphql';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { getDeviceName } from '@/app/(app)/devices/utils/device-name';
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
  /** The draft, once there is one. */
  bundleId: string | null;
  /** Creates the draft on the first assignment — see `useDraftBundle`. */
  ensureBundle: () => Promise<string>;
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
 *
 * The one difference is the first write: there is no bundle until then, so the
 * two adding actions create it first and the picker locks for the round trip.
 */
export function useBundleDeviceAssignment({
  bundleId,
  ensureBundle,
  filter,
  search,
  deferredFilter,
  deferredSearch,
}: UseBundleDeviceAssignmentOptions) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();

  // No in-flight flag for the single-row pair: the optimistic layer is their
  // state, per row, and a global one would only re-lock what it replaced.
  const [commitAdd] = useMutation<AddMutationType>(addMutation);
  const [commitRemove] = useMutation<RemoveMutationType>(removeMutation);
  const [commitAddAll, isAddingAll] = useMutation<AddAllMutationType>(addAllMutation);
  const [commitRemoveAll, isRemovingAll] = useMutation<RemoveAllMutationType>(removeAllMutation);
  const [isCreating, setCreating] = useState(false);

  // Only the wholesale writes lock the picker — they replace the list under the
  // user — plus the creation of the draft, during which a second click would
  // have nothing to write to yet.
  const busy = isAddingAll || isRemovingAll || isCreating;

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

  /** Runs a write against the draft, creating the draft first if there is none. */
  const withBundle = useCallback(
    (run: (id: string) => void, fallback: string) => {
      if (bundleId) {
        run(bundleId);
        return;
      }
      setCreating(true);
      void ensureBundle()
        .then(run, errorHandler(fallback))
        .finally(() => setCreating(false));
    },
    [bundleId, ensureBundle, errorHandler],
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
  // to what the server last said. On the very first add there is nothing to
  // patch yet — the bundle's lists are still loading — and the updater steps
  // aside; the lists arrive from the server with the device already in them.
  const addDevice = useCallback(
    (device: Device) => {
      withBundle(id => {
        commitAdd({
          variables: { bundleId: id, machineIds: [device.id] },
          ...assignmentUpdaters({ id, keys: BUNDLE_PICKER_CONNECTION_KEYS }, device.id, true, connectionNarrowing()),
          onCompleted: () => {
            toast({
              title: 'Device added',
              description: `"${getDeviceName(device)}" was added to the selection.`,
              variant: 'success',
            });
          },
          onError: errorHandler('Failed to add the device'),
        });
      }, 'Failed to add the device');
    },
    [withBundle, commitAdd, connectionNarrowing, toast, errorHandler],
  );

  const removeDevice = useCallback(
    (device: Device) => {
      // Nothing is assigned before there is a bundle, so there is nothing to remove.
      if (!bundleId) return;
      commitRemove({
        variables: { bundleId, machineIds: [device.id] },
        ...assignmentUpdaters(
          { id: bundleId, keys: BUNDLE_PICKER_CONNECTION_KEYS },
          device.id,
          false,
          connectionNarrowing(),
        ),
        onCompleted: () => {
          toast({
            title: 'Device removed',
            description: `"${getDeviceName(device)}" was removed from the selection.`,
            variant: 'success',
          });
        },
        onError: errorHandler('Failed to remove the device'),
      });
    },
    [bundleId, commitRemove, connectionNarrowing, toast, errorHandler],
  );

  const addAllDevices = useCallback(() => {
    const { filter: f, search: s } = narrowingRef.current;
    withBundle(id => {
      commitAddAll({
        variables: { bundleId: id, filter: toRelayDeviceFilter(f), search: s || null },
        onCompleted: response => {
          toast({
            title: 'Devices added',
            description: `${pluralize(response.addAllDevicesToSoftwareBundle.deviceCount, 'device')} selected.`,
            variant: 'success',
          });
          refreshLists(id);
        },
        onError: errorHandler('Failed to add the devices'),
      });
    }, 'Failed to add the devices');
  }, [withBundle, commitAddAll, toast, refreshLists, errorHandler]);

  const removeAllDevices = useCallback(() => {
    if (!bundleId) return;
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
