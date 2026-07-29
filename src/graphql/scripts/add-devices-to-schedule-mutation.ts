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
 * without anyone refetching.
 *
 * The connections are NOT patched by an updater. Membership of either list
 * depends on filters and search the server evaluates, not the client, so the
 * honest refresh is to re-read the affected connection.
 */
export const addDevicesToScheduleMutation = graphql`
  mutation addDevicesToScheduleMutation($scheduleId: ID!, $machineIds: [ID!]!) {
    addDevicesToSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {
      id
      deviceCount
    }
  }
`;
