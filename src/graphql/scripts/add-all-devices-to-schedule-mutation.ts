import { graphql } from 'react-relay';

/**
 * "Add All Devices" — assigns everything matching the Available list's CURRENT
 * filter and search, resolved on the server.
 *
 * That is the whole point of it being its own mutation rather than a bulk call
 * with collected ids: the client has only paged in part of the candidate list,
 * so a client-assembled set would quietly mean "add all the ones I happen to
 * have scrolled past". Pass the same `filter`/`search` the list is showing.
 *
 * See `add-devices-to-schedule-mutation.ts` for what the payload reads back.
 */
export const addAllDevicesToScheduleMutation = graphql`
  mutation addAllDevicesToScheduleMutation($scheduleId: ID!, $filter: DeviceFilterInput, $search: String) {
    addAllDevicesToSchedule(scheduleId: $scheduleId, filter: $filter, search: $search) {
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
