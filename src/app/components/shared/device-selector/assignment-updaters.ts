import { ConnectionHandler, type RecordSourceSelectorProxy } from 'relay-runtime';
import type { RelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';

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
  filter: RelayDeviceFilter | null;
  search: string | null;
}

/**
 * The record that owns an assignment — a script schedule, a software bundle —
 * and the `@connection` keys its picker reads the two halves under.
 */
export interface AssignmentOwner {
  /** The owner's Relay data id (its global id). */
  id: string;
  keys: {
    available: string;
    assigned: string;
  };
}

/**
 * The store writes for one device joining or leaving an assignment.
 *
 * Everything a single +/− changes is something the client already knows, so it
 * is written directly instead of being asked for again:
 *
 * - **Available** keeps the row and flips its `assigned` flag. The connection
 *   marks rather than excludes, so membership of that list does not move.
 * - **Selected** gains or loses the row. Safe to decide here, not a guess about
 *   what the server would return: both lists are queried with the SAME
 *   narrowing, so a device visible in Available necessarily satisfies the
 *   filter and search the Selected list is under.
 * - **`deviceCount`** moves by one, and stays moved — the payload does not
 *   restate it; see `addDevicesToScheduleMutation` for why.
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
  owner: AssignmentOwner,
  deviceId: string,
  assigned: boolean,
  narrowing: ConnectionNarrowing,
) {
  const delta = assigned ? 1 : -1;

  const patchLists = (store: RecordSourceSelectorProxy) => {
    const record = store.get(owner.id);
    if (!record) return;

    const available = ConnectionHandler.getConnection(record, owner.keys.available, narrowing);
    for (const edge of available?.getLinkedRecords('edges') ?? []) {
      if (edge?.getLinkedRecord('node')?.getDataID() === deviceId) edge.setValue(assigned, 'assigned');
    }

    const selected = ConnectionHandler.getConnection(record, owner.keys.assigned, narrowing);
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
    // owner's `deviceCount`.
    const filteredCount = selected.getValue('filteredCount');
    if (typeof filteredCount === 'number') {
      selected.setValue(Math.max(0, filteredCount + delta), 'filteredCount');
    }

    // The owner's own count — what the picker's tab label shows. Moved by the
    // same delta, in the same pass and under the same idempotency guard as the
    // lists, because the payload does not carry it: it answered with an ABSOLUTE
    // count, and two clicks whose responses crossed settled on the older of the
    // two snapshots. Deltas compose in any order.
    const deviceCount = record.getValue('deviceCount');
    if (typeof deviceCount === 'number') {
      record.setValue(Math.max(0, deviceCount + delta), 'deviceCount');
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
