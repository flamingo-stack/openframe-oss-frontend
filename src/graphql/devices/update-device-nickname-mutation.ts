import { graphql } from 'react-relay';

/**
 * Sets or clears a device's user-defined nickname (null/"" clears it).
 *
 * The payload selects the fields every surface derives the device name from:
 * `Machine implements Node`, so Relay merges them into the normalized record
 * and the list/picker rows re-render without a refetch. The raw-POST and
 * react-query surfaces (detail page, whole-fleet read) are refreshed by
 * `invalidateDeviceQueries` in the calling hook instead.
 */
export const updateDeviceNicknameMutation = graphql`
  mutation updateDeviceNicknameMutation($machineId: String!, $nickname: String) {
    updateDeviceNickname(machineId: $machineId, nickname: $nickname) {
      id
      nickname
      displayName
      hostname
    }
  }
`;
