import { graphql } from 'react-relay';

/**
 * "Remove N Devices" — unassigns everything matching the Selected list's
 * current filter and search, resolved on the server. With neither, it clears
 * the whole assignment.
 *
 * Server-resolved for the same reason as its counterpart
 * (`add-all-devices-to-schedule-mutation.ts`): the client holds only the pages
 * it has read, and "remove all" must mean all.
 */
export const removeAllDevicesFromScheduleMutation = graphql`
  mutation removeAllDevicesFromScheduleMutation($scheduleId: ID!, $filter: DeviceFilterInput, $search: String) {
    removeAllDevicesFromSchedule(scheduleId: $scheduleId, filter: $filter, search: $search) {
      id
      deviceCount
    }
  }
`;
