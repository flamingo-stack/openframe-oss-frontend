import { ConnectionHandler, type RecordSourceSelectorProxy } from 'relay-runtime';
import type { DeviceFilterInput as RelayDeviceFilterInput } from '@/__generated__/addAllDevicesToScheduleMutation.graphql';

export const AVAILABLE_CONNECTION_KEY = 'scheduleDevicePickerRelay_availableDevices';
export const ASSIGNED_CONNECTION_KEY = 'scheduleDevicePickerRelay_assignedDevices';

/**
 * The narrowing a connection record is keyed by.
 *
 * `@connection` folds every non-pagination argument into the connection's
 * storage key, so `availableDevices(filter:…, search:…)` is a DIFFERENT record
 * per narrowing. An updater therefore has to name the one the screen is reading
 * — which is the deferred pair, the same values the mounted queries were read
 * with.
 */
export interface ConnectionNarrowing {
  filter: RelayDeviceFilterInput;
  search: string | null;
}

/**
 * One narrowing PER HALF, because the halves are no longer read under the same
 * filter: Available carries the script-targetable status scope on top of the
 * user's narrowing (`toAvailableDeviceFilter`), Selected carries the narrowing
 * alone. An updater keyed by the wrong half's filter patches a connection
 * record nothing on screen is subscribed to.
 */
export interface AssignmentNarrowings {
  available: ConnectionNarrowing;
  assigned: ConnectionNarrowing;
}

/**
 * The store writes for one device joining or leaving the assignment.
 *
 * Everything a single +/− changes is something the client already knows, so it
 * is written directly instead of being asked for again:
 *
 * - **Available** keeps the row and flips its `assigned` flag. The connection
 *   marks rather than excludes, so membership of that list does not move.
 * - **Selected** gains or loses the row. Safe to decide here, not a guess about
 *   what the server would return: Available's filter is Selected's plus a
 *   statuses scope on top (see `AssignmentNarrowings`), so a device visible in
 *   Available necessarily satisfies the filter and search the Selected list is
 *   under.
 * - **`deviceCount`** moves by one, and stays moved — the payload no longer
 *   restates it; see `addDevicesToScheduleMutation` for why.
 *
 * This is what lets the row render ONCE. Re-reading both connections instead
 * would republish every node on the page, and a node whose `lastSeen` ticked
 * over in the meantime is a changed record — so the whole table would render
 * again a second later, restating what the click had already shown.
 *
 * Other narrowings' connection records are left stale on purpose. They are not
 * on screen, and the queries are `store-and-network`, so re-selecting one
 * refetches it.
 */
export function assignmentUpdaters(
  scheduleId: string,
  deviceId: string,
  assigned: boolean,
  narrowing: AssignmentNarrowings,
) {
  const delta = assigned ? 1 : -1;

  const patchLists = (store: RecordSourceSelectorProxy) => {
    const schedule = store.get(scheduleId);
    if (!schedule) return;

    const available = ConnectionHandler.getConnection(schedule, AVAILABLE_CONNECTION_KEY, narrowing.available);
    for (const edge of available?.getLinkedRecords('edges') ?? []) {
      if (edge?.getLinkedRecord('node')?.getDataID() === deviceId) edge.setValue(assigned, 'assigned');
    }

    const selected = ConnectionHandler.getConnection(schedule, ASSIGNED_CONNECTION_KEY, narrowing.assigned);
    if (!selected) return;
    const present = (selected.getLinkedRecords('edges') ?? []).some(
      edge => edge?.getLinkedRecord('node')?.getDataID() === deviceId,
    );
    // Idempotent, like the mutations themselves: re-adding what is already in
    // must not grow the list or the count.
    if (present === assigned) return;

    if (assigned) {
      const node = store.get(deviceId);
      if (!node) return;
      // At the front, because there is no cursor to place it by. The list is
      // server-sorted and this row has never been through that sort; it lands
      // in its real position with the next read of this connection.
      ConnectionHandler.insertEdgeBefore(selected, ConnectionHandler.createEdge(store, selected, node, 'DeviceEdge'));
    } else {
      ConnectionHandler.deleteNode(selected, deviceId);
    }

    // What the Selected list reports under itself — the narrowed count, not the
    // schedule's `deviceCount`.
    const filteredCount = selected.getValue('filteredCount');
    if (typeof filteredCount === 'number') {
      selected.setValue(Math.max(0, filteredCount + delta), 'filteredCount');
    }

    // The schedule's own count — what the picker's tab label and the DEVICES
    // column show. Moved by the same delta, in the same pass and under the same
    // idempotency guard as the lists, because the payload no longer carries it:
    // it answered with an ABSOLUTE count, and two clicks whose responses crossed
    // settled on the older of the two snapshots. Deltas compose in any order.
    const deviceCount = schedule.getValue('deviceCount');
    if (typeof deviceCount === 'number') {
      schedule.setValue(Math.max(0, deviceCount + delta), 'deviceCount');
    }
  };

  // ONE patch, applied twice: in the optimistic layer so the row and both counts
  // move on the click, and again on the real commit, by which point Relay has
  // dropped that layer — so the net effect is a single delta, exactly as it is
  // for `filteredCount`, which has always worked this way.
  //
  // A failure still needs no rollback: Relay drops the layer and nothing
  // replaces it, so the row and the counts go back to what the server last said.
  // And a sibling still in flight is rebased over the committed base, so its own
  // delta survives this commit instead of being overwritten by it.
  return { optimisticUpdater: patchLists, updater: patchLists };
}
