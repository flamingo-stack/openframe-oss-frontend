import { graphql } from 'react-relay';

/**
 * Step 3 — the full device row: everything the Devices page reads, on top of
 * [deviceSelectorFields_machine] and, through it, [deviceRowFields_machine].
 *
 * The ladder is what keeps the three device lists honest. They render the same
 * `Device` through the same tables but afford different amounts of fan-out
 * (`assignedDevices` resolves per machine and has timed out once on test-dev),
 * so each list spreads the step it can pay for and gets a transform typed to
 * exactly that step — `machineRowToDevice`, `machineSelectorToDevice`,
 * `machineToDevice`. Before the ladder, every list hand-listed its own fields
 * against one hand-written `MachineLike` whose fields were all optional, so a
 * missing selection silently produced an empty column instead of a type error.
 *
 * `Machine implements Node`, so Relay normalizes these records by `id` across
 * every query that spreads any step — the list, a picker and a detail tab read
 * one record, which is what keeps device state consistent between screens.
 *
 * `@inline` because the consumer is `machineToDevice`, a plain function — not a
 * component. `readInlineData` is how a fragment's data is read outside React;
 * without it the spread would hand back an opaque fragment reference and every
 * row would need its own `useFragment` component.
 */
export const deviceFieldsFragment = graphql`
  fragment deviceFields_machine on Machine @inline {
    ...deviceSelectorFields_machine
    nickname
    ip
    macAddress
    osUuid
    agentVersion
    osVersion
    osBuild
    timezone
    registeredAt
    updatedAt
    toolConnections {
      id
      machineId
      toolType
      agentToolId
      status
      metadata
      connectedAt
      lastSyncAt
      disconnectedAt
    }
  }
`;
