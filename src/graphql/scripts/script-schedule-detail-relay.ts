import { graphql } from 'react-relay';

/**
 * Single schedule query (v2). Resolves the schedule itself and the scripts it
 * runs (in run order) — everything the detail / edit / devices pages need
 * EXCEPT the assigned machines. `assignedDevices` deliberately lives in its own
 * query (`script-schedule-devices-relay.ts`): the per-machine resolution is
 * heavy enough to 504 on real fleets, so only the views that actually render
 * devices pay for it.
 */
export const scriptScheduleDetailRelayQuery = graphql`
  query scriptScheduleDetailRelayQuery($id: ID!) {
    scriptSchedule(id: $id) {
      id
      name
      description
      supportedPlatforms
      status
      # "Added by" in the details info bar. Resolved through the user
      # DataLoader, so it is one lookup for the schedule — not per row.
      author {
        id
        firstName
        lastName
        email
      }
      deviceCount
      # How the schedule targets devices. SPECIFIC reads the assignment as a
      # stored list; CRITERIA resolves it live from this rule, so devices
      # registered later that match are picked up without anyone editing it.
      selectionMode
      deviceCriteria {
        organizationIds
        deviceTypes
        osTypes
      }
      trigger
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
        # The source shown when a script card is expanded (design 1:49182).
        # It rides this query rather than a per-card fetch: a schedule holds a
        # handful of scripts, and the card is expanded from a list where a
        # request per toggle would be the worse trade.
        scriptBody
        envVars {
          name
          value
        }
      }
    }
  }
`;
