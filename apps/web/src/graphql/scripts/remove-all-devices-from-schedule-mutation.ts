import { graphql } from 'react-relay';

/**
 * "Remove N Devices" — unassigns everything matching the Selected list's
 * current filter and search, resolved on the server. With neither, it clears
 * the whole assignment.
 *
 * Server-resolved for the same reason as its counterpart
 * (`add-all-devices-to-schedule-mutation.ts`): the client holds only the pages
 * it has read, and "remove all" must mean all. See
 * `add-devices-to-schedule-mutation.ts` for what the payload reads back.
 */
export const removeAllDevicesFromScheduleMutation = graphql`
  mutation removeAllDevicesFromScheduleMutation($scheduleId: ID!, $filter: DeviceFilterInput, $search: String) {
    removeAllDevicesFromSchedule(scheduleId: $scheduleId, filter: $filter, search: $search) {
      id
      deviceCount
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
