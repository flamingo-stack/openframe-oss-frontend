import { graphql } from 'react-relay';

/**
 * What the "Edit Devices" page needs BEFORE it can draw anything: how the
 * schedule targets devices, plus the fields its info bar shows.
 *
 * Split out of `scriptScheduleDetailRelayQuery` on purpose. That query also
 * resolves `scripts { … scriptBody envVars }` — the source of every script the
 * schedule runs — which this page never renders, and waiting on it delays the
 * one answer the page cannot start without: SPECIFIC or CRITERIA decides which
 * half of the picker exists at all. The devices themselves are a third query,
 * issued by whichever half wins, so the heavy list loads under a picker that is
 * already on screen instead of behind it.
 *
 * Relay normalizes by node, so arriving from the details page — which is how
 * this page is reached — these fields are already in the store and the query
 * answers from it on the FIRST render, without suspending. The request still
 * goes out: the consumer reads this with `store-and-network`, which always
 * refetches, and that revalidation is what the cached answer is traded against
 * — the page draws immediately and corrects itself if the schedule moved.
 *
 * It also selects everything `updateScriptSchedule` overwrites, which is what
 * lets this page flip a schedule back to SPECIFIC (`selectionMode` on the
 * update input). That mutation is a full PUT — a partial input clears the
 * fields it omits — so the mode switch has to send the schedule back
 * unchanged around the one field it means to change. `scripts { id }` and
 * `scriptCustomParams` are here for that write alone, not for anything this
 * page renders; the ids are cheap, and dropping them would have the switch
 * empty the schedule's recipe.
 *
 * `offlineBehavior` / `reconnectWindowSeconds` are here for that write alone as
 * well, and they are the sharper case: the input reads a null `offlineBehavior`
 * as SKIP, so omitting them would not merely blank a field — it would silently
 * downgrade a RETRY_ON_RECONNECT schedule to skipping, from a page about device
 * targeting that never mentions either.
 */
export const scriptScheduleDevicesSettingsRelayQuery = graphql`
  query scriptScheduleDevicesSettingsRelayQuery($id: ID!) {
    scriptSchedule(id: $id) {
      id
      name
      description
      supportedPlatforms
      trigger
      # What happens to a device that is offline when the schedule fires. Never
      # null on the read side — a schedule stored before the field existed reads
      # as SKIP. reconnectWindowSeconds is the deadline a queued run is abandoned
      # at, and is null for SKIP.
      offlineBehavior
      reconnectWindowSeconds
      startAt
      repeat
      # The answer the page branches on.
      selectionMode
      deviceCriteria {
        organizationIds
        deviceTypes
        osTypes
      }
      # PUT payload only — see above.
      scripts {
        id
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
