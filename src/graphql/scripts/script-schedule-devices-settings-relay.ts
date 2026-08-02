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
 * answers without a request.
 */
export const scriptScheduleDevicesSettingsRelayQuery = graphql`
  query scriptScheduleDevicesSettingsRelayQuery($id: ID!) {
    scriptSchedule(id: $id) {
      id
      name
      description
      supportedPlatforms
      trigger
      startAt
      repeat
      # The answer the page branches on.
      selectionMode
      deviceCriteria {
        organizationIds
        deviceTypes
        osTypes
      }
    }
  }
`;
