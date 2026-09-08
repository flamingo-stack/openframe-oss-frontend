import { graphql } from 'react-relay';

/**
 * Full replacement (PUT semantics) of a schedule. Selects every editable field
 * (mirrors `scriptScheduleDetailRelayQuery`) so Relay merges the full updated
 * node into the store by `id` and the detail page re-renders without waiting on
 * its own refetch. Keep this selection in sync with the detail query.
 */
export const updateScriptScheduleMutation = graphql`
  mutation updateScriptScheduleMutation($input: UpdateScriptScheduleInput!) {
    updateScriptSchedule(input: $input) {
      id
      name
      description
      supportedPlatforms
      status
      deviceCount
      trigger
      # What happens to a device that is offline when the schedule fires. Never
      # null on the read side — a schedule stored before the field existed reads
      # as SKIP. reconnectWindowSeconds is the deadline a queued run is abandoned
      # at, and is null for SKIP.
      offlineBehavior
      reconnectWindowSeconds
      # Which clock startAt is in: SERVER is one absolute instant, DEVICE_LOCAL
      # is a wall clock re-based into each device's own timezone. Never null on
      # the read side — a schedule stored before the field existed reads as
      # SERVER — and it is what tells the display whether to convert.
      timeReference
      startAt
      repeat
      nextRunAt
      lastRunAt
      # Written by this mutation when the Edit Devices page flips a schedule back
      # to SPECIFIC, so the picker's mode radio settles from the store.
      selectionMode
      deviceCriteria {
        organizationIds
        deviceTypes
        osTypes
      }
      scripts {
        id
        name
        shell
        supportedPlatforms
        defaultTimeoutSeconds
        defaultArgs
        envVars {
          name
          value
          secret
        }
      }
      scriptCustomParams {
        scriptId
        args
        envVars {
          name
          value
          secret
        }
      }
    }
  }
`;
