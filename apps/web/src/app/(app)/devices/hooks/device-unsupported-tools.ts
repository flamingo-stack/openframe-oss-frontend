import { graphql } from 'react-relay';
import { fetchQuery } from 'relay-runtime';
import type { deviceUnsupportedToolsQuery as DeviceUnsupportedToolsQueryType } from '@/__generated__/deviceUnsupportedToolsQuery.graphql';
import { getRelayEnvironment } from '@/lib/relay/environment';
import type { UnsupportedTool } from '../types/device.types';

/**
 * The integrated agents this device's OS version is below the minimum of (oss-lib#3138). Asked on its own, beside
 * the device query, so a backend without the field fails only this request.
 */
const unsupportedToolsQuery = graphql`
  query deviceUnsupportedToolsQuery($machineId: String!) {
    device(machineId: $machineId) {
      unsupportedTools {
        toolType
        minOsVersion
        osVersion
      }
    }
  }
`;

/**
 * The agents this device's OS version does not support (`Machine.unsupportedTools`). Any failure reads as none: a
 * backend that predates the field refuses the query, and the device page must keep working there exactly as before.
 * Fetched by `useDeviceDetails` beside the detail node, and `network-only` like it, so every poll sees the latest
 * OS report.
 */
export async function fetchDeviceUnsupportedTools(machineId: string): Promise<UnsupportedTool[]> {
  try {
    const data = await fetchQuery<DeviceUnsupportedToolsQueryType>(
      getRelayEnvironment(),
      unsupportedToolsQuery,
      { machineId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    return (data?.device?.unsupportedTools ?? []).map(tool => ({
      toolType: tool.toolType,
      minOsVersion: tool.minOsVersion,
      osVersion: tool.osVersion,
    }));
  } catch {
    return [];
  }
}
