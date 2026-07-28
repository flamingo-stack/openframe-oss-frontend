import { graphql } from 'react-relay';

/**
 * Unassigns devices from a schedule; ids that are not assigned are no-ops.
 * The delta rationale and the `deviceCount` contract live on its sibling,
 * `add-devices-to-schedule-mutation.ts`.
 */
export const removeDevicesFromScheduleMutation = graphql`
  mutation removeDevicesFromScheduleMutation($scheduleId: ID!, $machineIds: [ID!]!) {
    removeDevicesFromSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {
      id
      deviceCount
    }
  }
`;
