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
 * See `add-devices-to-schedule-mutation.ts` for why the payload reads back
 * nothing but `id`.
 */
export const addAllDevicesToScheduleMutation = graphql`
  mutation addAllDevicesToScheduleMutation($scheduleId: ID!, $filter: DeviceFilterInput, $search: String) {
    addAllDevicesToSchedule(scheduleId: $scheduleId, filter: $filter, search: $search) {
      id
    }
  }
`;
