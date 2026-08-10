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
 * Facet counts only — status + per-organization breakdowns and the total.
 *
 * The counter surfaces (dashboard stat cards, customer device counts, the
 * customers overview) need nothing but the numbers. The full facet set the
 * filter UI needs is a Relay document — `deviceFiltersRelayQuery`.
 */
export const GET_DEVICE_COUNTS_QUERY = `
  query GetDeviceCounts($filter: DeviceFilterInput) {
    deviceFilters(filter: $filter) {
      statuses {
        value
        count
      }
      organizationIds {
        value
        count
      }
      filteredCount
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
      nickname
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
