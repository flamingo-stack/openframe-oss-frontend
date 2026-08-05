import { graphql } from 'react-relay';

/**
 * Switches a schedule to CRITERIA targeting and stores its rule.
 *
 * Unlike the four assignment mutations next to it, this one is NOT a delta and
 * is NOT committed per interaction: the rule is a single value the server
 * replaces wholesale, and applying it re-points the schedule at a live set
 * ("every device that matches, including ones registered tomorrow"). That is a
 * change of how the schedule targets devices, not an edit to a list — so the
 * picker collects the whole rule and commits it behind an explicit Save.
 *
 * The payload reads back exactly what the write changed, plus `deviceCount` —
 * how many devices the new rule resolves to — so the schedule record already in
 * the Relay store (the schedule detail query) updates itself
 * without a refetch.
 *
 * The return trip does NOT come through here: `selectionMode` on
 * `UpdateScriptScheduleInput` is what switches a schedule back to SPECIFIC (see
 * `use-schedule-selection-mode.ts`, and §10 of the same doc). Flipping either way
 * leaves the stored rule and the join rows alone, so a schedule moved back to
 * SPECIFIC still has its criteria on file if it is ever moved across again.
 */
export const setScheduleDeviceCriteriaMutation = graphql`
  mutation setScheduleDeviceCriteriaMutation($scheduleId: ID!, $criteria: ScheduleDeviceCriteriaInput!) {
    setScheduleDeviceCriteria(scheduleId: $scheduleId, criteria: $criteria) {
      id
      deviceCount
      selectionMode
      deviceCriteria {
        organizationIds
        deviceTypes
        osTypes
      }
    }
  }
`;
