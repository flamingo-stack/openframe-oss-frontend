import { graphql } from 'react-relay';

/**
 * The smallest query that names MANAGED as an enum literal: a backend whose `DeviceStatus` has no MANAGED refuses
 * it at validation, one that has it answers. Read by `lib/device-status-support.ts`.
 */
export const deviceStatusSupportRelayQuery = graphql`
  query deviceStatusSupportRelayQuery {
    deviceFilters(filter: { statuses: [MANAGED] }) {
      filteredCount
    }
  }
`;
