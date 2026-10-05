import { graphql } from 'react-relay';

/**
 * Creates a schedule. Selects the fields the detail page reads so the store is
 * warm when the create flow replaces the URL with the new schedule's detail
 * page (its `store-and-network` read renders instantly from this payload).
 */
export const createScriptScheduleMutation = graphql`
  mutation createScriptScheduleMutation($input: CreateScriptScheduleInput!) {
    createScriptSchedule(input: $input) {
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
