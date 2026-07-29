import { graphql } from 'react-relay';

/**
 * Unassigns devices from a schedule; ids that are not assigned are no-ops.
 * The delta rationale, and what the payload reads back, live on its sibling
 * `add-devices-to-schedule-mutation.ts`.
 */
export const removeDevicesFromScheduleMutation = graphql`
  mutation removeDevicesFromScheduleMutation($scheduleId: ID!, $machineIds: [ID!]!) {
    removeDevicesFromSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {
      id
    }
  }
`;
