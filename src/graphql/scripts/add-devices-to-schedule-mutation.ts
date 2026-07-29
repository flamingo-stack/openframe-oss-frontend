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
 * The payloads read back `id` and `deviceCount`. The count is the number the
 * picker's tab label and the schedule's DEVICES column show, and it is keyed by
 * `id`, so Relay writes it into the normalized store and both update themselves
 * without anyone refetching. That is also why the picker shows a click on the
 * count through an `optimisticUpdater` over the same field rather than an offset
 * of its own: this payload overwrites the field the moment it lands, so a
 * separate offset would be counted a second time until it retired.
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
      deviceCount
    }
  }
`;
