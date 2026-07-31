'use client';

/**
 * The IMPERATIVE half of the device data layer — the reads that can't be a hook.
 *
 * The list, the pickers and the filter facets are Relay hooks over
 * `src/graphql/devices/`. What lives here is what a hook can't serve: a
 * react-query `queryFn` (the ticket-form autocomplete), a singleton service (the
 * dashboard counters), a cursor walk (the whole-fleet lookup), and the detail
 * node that `useDeviceDetails` merges with Fleet and MeshCentral.
 *
 * Each function owns its document, variables, response unwrapping and
 * node → `Device` transform, so callers get `Device` objects or plain counts and
 * never see a GraphQL envelope.
 */

import { fetchQuery } from 'relay-runtime';
import type { devicesPageRelayQuery as DevicesPageRelayQueryType } from '@/__generated__/devicesPageRelayQuery.graphql';
import { devicesPageRelayQuery } from '@/graphql/devices/devices-page-relay';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { apiClient } from '@/lib/api-client';
import { getRelayEnvironment } from '@/lib/relay/environment';
import type { Device, DeviceFilterInput, DeviceGraphQlNode, GraphQlResponse } from '../types/device.types';
import { readMachineEdges } from '../utils/read-machine';
import { GET_DEVICE_COUNTS_QUERY, GET_DEVICE_QUERY } from './devices-queries';

/**
 * Page size of the scrolled list. Lives here rather than in the hook because the
 * hook and this module are the two places that need it, and the data layer is
 * the one both can import without a cycle. Mirrored as `defaultValue: 20` in
 * `devicesListRelay_query` — relay-compiler needs a literal in a static document.
 */
export const DEVICES_PAGE_SIZE = 20;

/** Page size used when a caller needs the whole fleet, to cut round-trips. */
export const DEVICES_BULK_PAGE_SIZE = 100;

export interface DevicesPageInfo {
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface DevicesPage {
  devices: Device[];
  pageInfo: DevicesPageInfo;
  filteredCount: number;
}

export interface DevicesQueryVariables {
  filter?: DeviceFilterInput;
  search?: string;
  first?: number;
  after?: string | null;
}

/** Status value → device count, and organization id → device count. */
export interface DeviceCounts {
  filteredCount: number;
  byStatus: ReadonlyMap<string, number>;
  byOrganization: ReadonlyMap<string, number>;
}

interface DeviceCountsResponse {
  deviceFilters: {
    filteredCount: number;
    statuses?: Array<{ value: string; count: number }>;
    organizationIds?: Array<{ value: string; count: number }>;
  };
}

/**
 * Turns any device request failure — transport, empty body, GraphQL `errors` —
 * into a single thrown `Error`, so every device hook surfaces failures the same
 * way instead of each re-deriving its own message.
 */
async function postDeviceQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await apiClient.post<GraphQlResponse<T>>('/api/graphql', { query, variables });

  if (!response.ok) {
    throw new Error(response.error || `Request failed with status ${response.status}`);
  }

  const body = response.data;
  if (body?.errors && body.errors.length > 0) {
    throw new Error(body.errors[0].message || 'GraphQL error occurred');
  }
  if (!body?.data) {
    throw new Error('No data received from server');
  }

  return body.data;
}

/**
 * One page of devices, already transformed into `Device` list items.
 *
 * Imperative (`fetchQuery`) rather than a hook, for the callers that need
 * devices outside React's render — a react-query `queryFn`, or the cursor walk
 * below. It runs the SAME document the suspending pickers use, so the rows land
 * in the Relay store as normalized `Machine` records either way.
 */
export async function fetchDevicesPage({
  filter,
  search = '',
  first = DEVICES_PAGE_SIZE,
  after = null,
}: DevicesQueryVariables = {}): Promise<DevicesPage> {
  const data = await fetchQuery<DevicesPageRelayQueryType>(getRelayEnvironment(), devicesPageRelayQuery, {
    filter: toRelayDeviceFilter(filter),
    search: search || null,
    first,
    after,
  }).toPromise();

  // `toPromise()` resolves undefined if the observable completes without
  // emitting. Falling through to an empty page would let `fetchAllDevices`
  // cache "the fleet is empty" as a SUCCESS, and the monitoring tables would
  // render every Fleet host unenriched instead of showing an error.
  if (!data?.devices) {
    throw new Error('No device data received from server');
  }

  return {
    devices: readMachineEdges(data.devices.edges),
    pageInfo: {
      hasNextPage: data.devices.pageInfo?.hasNextPage ?? false,
      endCursor: data.devices.pageInfo?.endCursor ?? undefined,
    },
    filteredCount: data.devices.filteredCount ?? 0,
  };
}

/**
 * Every device matching `filter`, following the cursor to exhaustion.
 *
 * For callers that need the fleet as a lookup table (monitoring tables mapping
 * Fleet hosts back to devices), not for anything the user scrolls.
 */
export async function fetchAllDevices({
  filter,
  search = '',
  first = DEVICES_BULK_PAGE_SIZE,
}: Omit<DevicesQueryVariables, 'after'> = {}): Promise<Device[]> {
  const all: Device[] = [];
  let after: string | null = null;

  for (;;) {
    const page = await fetchDevicesPage({ filter, search, first, after });
    all.push(...page.devices);

    const { hasNextPage, endCursor } = page.pageInfo;
    // Four ways to stop, because only the first is the server behaving: no
    // successor, a null cursor, a cursor that did not move, or a page that came
    // back empty while still claiming more. The walk is unbounded, so any of the
    // last three would otherwise spin forever.
    if (!hasNextPage || !endCursor || endCursor === after || page.devices.length === 0) return all;
    after = endCursor;
  }
}

/** Device counters only — the facet subset the stat cards and counters need. */
export async function fetchDeviceCounts(filter: DeviceFilterInput = {}): Promise<DeviceCounts> {
  const data = await postDeviceQuery<DeviceCountsResponse>(GET_DEVICE_COUNTS_QUERY, { filter });

  return {
    filteredCount: data.deviceFilters.filteredCount ?? 0,
    byStatus: new Map((data.deviceFilters.statuses ?? []).map(entry => [entry.value, entry.count])),
    byOrganization: new Map((data.deviceFilters.organizationIds ?? []).map(entry => [entry.value, entry.count])),
  };
}

/**
 * The raw GraphQL node for one device. Detail-only fields (`installedAgents`)
 * come with it; `useDeviceDetails` merges it with Fleet and MeshCentral.
 */
export async function fetchDeviceNode(machineId: string): Promise<DeviceGraphQlNode> {
  const data = await postDeviceQuery<{ device: DeviceGraphQlNode | null }>(GET_DEVICE_QUERY, { machineId });
  if (!data.device) {
    throw new Error('Device not found');
  }
  return data.device;
}
