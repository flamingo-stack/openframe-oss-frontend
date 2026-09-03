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
 * One document per counter so each response carries only what its caller reads;
 * `GetDeviceCounts` used to return all of statuses + organizationIds +
 * filteredCount to callers that each used one of them.
 *
 * This narrows the RESPONSE, not the backend's work: `deviceFilters` is a single
 * DGS query (`DeviceDataFetcher.deviceFilters` → `DeviceFilterService`) that runs
 * all six Pinot facet queries in parallel and builds the whole `DeviceFilters`
 * object before GraphQL trims it to the selection set. So a narrower document
 * costs the backend exactly the same, and an ADDITIONAL document costs another
 * full six-query resolution — when a new counter needs a facet one of these
 * already fetches, widen that document rather than adding a third.
 *
 * The full facet set the filter UI needs is a Relay document —
 * `deviceFiltersRelayQuery`.
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
