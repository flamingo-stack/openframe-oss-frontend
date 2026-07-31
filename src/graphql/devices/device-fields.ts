import { graphql } from 'react-relay';

/**
 * The per-row field set every device list renders.
 *
 * A fragment on `Machine` rather than a repeated selection: the infinite list
 * and the bounded pickers feed the same `Device` shape into the same shared
 * tables, so they must select the same fields. Spreading one fragment makes that
 * structural instead of a convention two documents are trusted to follow.
 *
 * The schedule tables (`script-schedule-devices-relay.ts`,
 * `schedule-device-picker-relay.ts`) deliberately do NOT spread this — they
 * select a narrower row, because `assignedDevices` already resolves per machine
 * and has timed out once on test-dev; adding this fragment's `toolConnections`
 * and `contactInformation` fan-out there would make that worse. They share the
 * `machineToDevice` transform, not the selection.
 *
 * `Machine implements Node`, so Relay normalizes these records by `id` across
 * every query that spreads this — the list, a picker and a detail tab read one
 * record, which is what keeps device state consistent between screens.
 *
 * `@inline` because the consumer is `machineToDevice`, a plain function that
 * flattens a row into the `Device` the shared tables render — not a component.
 * `readInlineData` is how a fragment's data is read outside React; without it
 * the spread would hand back an opaque fragment reference and every row would
 * need its own `useFragment` component.
 */
export const deviceFieldsFragment = graphql`
  fragment deviceFields_machine on Machine @inline {
    id
    machineId
    hostname
    displayName
    ip
    macAddress
    osUuid
    agentVersion
    status
    lastSeen
    organization {
      id
      organizationId
      name
      # The CUSTOMER column's second line. The organization is already joined
      # here for name + logo, so this rides along rather than adding a fan-out.
      contactInformation {
        contacts {
          email
        }
      }
      image {
        imageUrl
        hash
      }
    }
    serialNumber
    manufacturer
    model
    type
    osType
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
    tags {
      id
      key
      description
      color
      values
      createdAt
    }
  }
`;
