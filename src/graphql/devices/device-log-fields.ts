import { graphql } from 'react-relay';

/**
 * One agent log line as both the list page and the 5-second poll select it —
 * `@inline` because the reader is `toUiDeviceLog`, a plain mapper, and a shared
 * fragment is what keeps the two operations from drifting apart.
 */
export const deviceLogFieldsFragment = graphql`
  fragment deviceLogFields_entry on DeviceLogEntry @inline {
    timestamp
    agentTimestamp
    level
    message
    hostname
    count
  }
`;
