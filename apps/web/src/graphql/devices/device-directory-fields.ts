import { graphql } from 'react-relay';

/**
 * The USER and SOURCES columns of the Devices list: stored on the machine, written by the SaaS matcher, inert in OSS
 * (none, empty).
 *
 * Its own fragment rather than a step of the ladder in `device-fields.ts`, because these fields exist only in the
 * Tenant Management Phase 2 schema (`tenant-management-v2`): the pickers spread `deviceFields_machine` through
 * `devicesPageRelayQuery` whatever the flag says, so only the list that draws these columns spreads this one.
 */
export const deviceDirectoryFieldsFragment = graphql`
  fragment deviceDirectoryFields_machine on Machine @inline {
    directorySources
    directoryUserLink
    directoryUserIds
    directoryUserName
  }
`;
