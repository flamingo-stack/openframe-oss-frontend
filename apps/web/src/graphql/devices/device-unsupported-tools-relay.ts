import { graphql } from 'react-relay';
import { fetchQuery } from 'relay-runtime';
import type { deviceUnsupportedToolsRelayQuery as DeviceUnsupportedToolsRelayQueryType } from '@/__generated__/deviceUnsupportedToolsRelayQuery.graphql';
import type { UnsupportedTool } from '@/app/(app)/devices/types/device.types';
import { getRelayEnvironment } from '@/lib/relay/environment';

/**
 * The integrated agents this device's OS version is below the minimum of (oss-lib#3138). Asked on its own, beside
 * the device query, so a backend without the field fails only this request.
 */
export const deviceUnsupportedToolsRelayQuery = graphql`
  query deviceUnsupportedToolsRelayQuery($machineId: String!) {
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
 * The agents this device's OS version does not support (`Machine.unsupportedTools`), for the device page
 * (`useDeviceDetails`). Any failure reads as none: a backend that predates the field refuses the query, and the
 * device page must keep working there exactly as before. `network-only`, like the detail node it is fetched beside,
 * so every poll sees the latest OS report.
 */
export async function fetchDeviceUnsupportedTools(machineId: string): Promise<UnsupportedTool[]> {
  try {
    const data = await fetchQuery<DeviceUnsupportedToolsRelayQueryType>(
      getRelayEnvironment(),
      deviceUnsupportedToolsRelayQuery,
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
