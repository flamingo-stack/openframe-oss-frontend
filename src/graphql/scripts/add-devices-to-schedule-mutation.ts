import { graphql } from 'react-relay';

/**
 * Adds devices to a schedule's assignment — idempotent, so re-adding one that
 * is already assigned is a no-op, and OS mismatches are rejected server-side.
 *
 * This and its three siblings (`remove-devices-from-schedule-mutation`,
 * `add-all-devices-to-schedule-mutation`, `remove-all-devices-from-schedule-mutation`)
 * replace `setScriptScheduleDevices`, which took the ENTIRE machine set and
 * overwrote the assignment with it. That shape forced the editor to hold the
 * whole assignment in memory or risk dropping the part it had not read — a
 * guarantee it could not make once an assignment outgrew a single page. A delta
 * states only what changed, so nothing has to be read in full to write safely.
 *
 * The payloads read back `id` and the SELECTION MODE. `deviceCount` — the number the picker's tab
 * label and the schedule's DEVICES column show — used to come back with it and be
 * written straight into the normalized store, which is right for one mutation in
 * flight and wrong for two: each response carries an ABSOLUTE snapshot, so two
 * clicks whose responses crossed left the count on the OLDER of them, and it
 * stayed there until something refetched.
 *
 * So the picker owns that number as a delta instead (`assignmentUpdaters` in
 * `schedule-devices-view.tsx`), applied in the optimistic layer and again on
 * commit. Deltas from concurrent clicks compose in any order; absolute counts
 * cannot be ordered by a client that has no sequence to order them by. The
 * server's own number is not lost — it arrives with every read of the schedule,
 * and with the refetch the bulk siblings below already do.
 *
 * `selectionMode` is exempt from that argument, and deliberately selected: it is
 * not a running total but a state the server owns, so two responses that cross
 * carry the SAME answer and cannot land out of order the way two counts can.
 *
 * The picker's two connections ARE patched by an updater rather than refetched
 * (`assignmentUpdaters` in `schedule-devices-view.tsx`), which is safe for this
 * pair precisely because it names its machines: the one row that moves is known,
 * and it satisfies whatever narrowing is on screen — both lists are read with
 * the same one, so a device visible in Available belongs in Selected too. The
 * BULK siblings have no such guarantee. They take a filter the server resolves,
 * so what is left in either list afterwards is not something the client can work
 * out, and those re-read.
 */
export const addDevicesToScheduleMutation = graphql`
  mutation addDevicesToScheduleMutation($scheduleId: ID!, $machineIds: [ID!]!) {
    addDevicesToSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {
      id
      # The mode is asked for on every assignment write, and that is not
      # decoration: setScheduleDeviceCriteria is the only documented way to
      # CHANGE the mode, and nothing in the schema documents what assigning a
      # device does to a CRITERIA schedule (gaps doc §10). Selecting it here
      # means the server's answer — whatever it is — lands in the store instead
      # of the page keeping a stale CRITERIA the user has just edited away.
      selectionMode
      deviceCriteria {
        organizationIds
        deviceTypes
        osTypes
      }
    }
  }
`;
