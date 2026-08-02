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
      # The mode is asked for on every assignment write, and that is not
      # decoration: setScheduleDeviceCriteria is the only documented way to
      # CHANGE the mode, and nothing in the schema documents what assigning a
      # device does to a CRITERIA schedule (gaps doc §10). Selecting it here
      # means the server's answer — whatever it is — lands in the store instead
      # of the page keeping a stale CRITERIA the user has just edited away.
      selectionMode
      deviceCriteria {
        organizationIds
        deviceTypes
        osTypes
      }
    }
  }
`;
