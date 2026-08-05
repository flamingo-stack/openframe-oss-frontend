import { graphql } from 'react-relay';

/**
 * A schedule's trigger, alone — what the details page needs before it can decide
 * which TABS exist (`DEVICE_ONLINE` has no Schedule Runs; see
 * `schedule-detail-tabs.ts`).
 *
 * Deliberately not `scriptScheduleDetailRelayQuery`, which the header and the
 * info bar read: that one also resolves every script's `scriptBody`, and the tab
 * STRIP would then wait behind the source of the whole recipe — the one piece of
 * page chrome that used to paint immediately.
 *
 * Two fields keep it cheap in a second way: `trigger` is already selected by the
 * schedules table, so arriving from the list — which is how this page is reached
 * — Relay answers this from its store on the first render and never suspends.
 * The strip is then drawn correctly on the first paint, and the request that
 * still goes out (`store-and-network`) only revalidates it.
 */
export const scheduleTriggerRelayQuery = graphql`
  query scheduleTriggerRelayQuery($id: ID!) {
    scriptSchedule(id: $id) {
      id
      trigger
    }
  }
`;
