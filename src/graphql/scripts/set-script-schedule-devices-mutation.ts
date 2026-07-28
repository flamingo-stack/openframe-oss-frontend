import { graphql } from 'react-relay';

/**
 * Replaces the full set of devices assigned to a schedule (PUT semantics —
 * backs "Edit Devices"). `machineIds` are Machine GLOBAL ids (`Machine.id`),
 * not the `machineId` string field.
 *
 * Only `deviceCount` is selected: `assignedDevices` is a paginated connection,
 * and a payload selection can't be merged into the tab's `@connection` (its
 * page arguments differ), so the assignment is re-read instead — the Assigned
 * Devices tab runs `store-and-network` and refetches on mount.
 */
export const setScriptScheduleDevicesMutation = graphql`
  mutation setScriptScheduleDevicesMutation($scheduleId: ID!, $machineIds: [ID!]!) {
    setScriptScheduleDevices(scheduleId: $scheduleId, machineIds: $machineIds) {
      id
      deviceCount
    }
  }
`;
