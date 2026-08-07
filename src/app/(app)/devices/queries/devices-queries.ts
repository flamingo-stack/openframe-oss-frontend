/**
 * The raw-POST device documents — the reads that are NOT yet on Relay.
 *
 * The device list and the filter facets are Relay documents under
 * `src/graphql/devices/`. What is left here is the detail-page node, the counter
 * facets, and an organization probe the Devices page gates its "Add Device"
 * action on. Do not inline a `devices`/`deviceFilters` selection anywhere else;
 * extend a document here or add a Relay one.
 */

/**
 * Minimal probe for whether the tenant has any organizations (customers).
 * Used on the Devices page to gate the "Add Device" action: a device must be
 * attached to an organization, so with none we steer the user to add a customer.
 */
export const HAS_ORGANIZATIONS_QUERY = `
  query HasOrganizations {
    organizations(first: 1) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

/**
 * Facet counts only — the numbers the counter surfaces need, and NOTHING else.
 *
 * Split into one document per counter on purpose: every field of `DeviceFilters`
 * is a separate Pinot query on the backend, resolved from the SELECTION SET, so
 * a document that asks for a facet nobody reads pays a full round trip for it.
 * These two used to be one `GetDeviceCounts` selecting statuses + organizationIds
 * + filteredCount, which meant the dashboard stat cards ran the per-organization
 * GROUP BY they discard, and the customers overview ran the status breakdown it
 * discards — on every load, three times over.
 *
 * Keep them narrow. If a new counter needs a different facet, add a third
 * document rather than widening one of these. The full facet set the filter UI
 * needs is a Relay document — `deviceFiltersRelayQuery`.
 */
export const GET_DEVICE_STATUS_COUNTS_QUERY = `
  query GetDeviceStatusCounts($filter: DeviceFilterInput) {
    deviceFilters(filter: $filter) {
      statuses {
        value
        count
      }
      filteredCount
    }
  }
`;

/** Per-organization device counts — the customers table and the dashboard overview. */
export const GET_DEVICE_ORGANIZATION_COUNTS_QUERY = `
  query GetDeviceOrganizationCounts($filter: DeviceFilterInput) {
    deviceFilters(filter: $filter) {
      organizationIds {
        value
        count
      }
    }
  }
`;

export const GET_DEVICE_QUERY = `
  query GetDevice($machineId: String!) {
    device(machineId: $machineId) {
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
      tags {
        id
        key
        description
        color
        values
        createdAt
      }
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
      installedAgents {
        id
        machineId
        agentType
        version
        createdAt
        updatedAt
      }
    }
  }
`;
