import { graphql } from 'react-relay';

/**
 * A single schedule fire (Schedule Run Details page, Figma 310:33508). The schema
 * has no `scheduleRun(id)` field — only the `scheduleRuns(scheduleId:)` list — so
 * the record is resolved through the generic `node(id)` entry point and narrowed
 * to `ScheduleRun`, the same way `script-execution-detail-relay.ts` does.
 *
 * `scheduleId` and `executionId` are what make the page work at all: the first is
 * where Back goes and how the executions below are scoped to a schedule, the
 * second is the id every execution of this fire carries and therefore the only
 * handle the API offers for narrowing the list to THIS run.
 */
export const scheduleRunDetailRelayQuery = graphql`
  query scheduleRunDetailRelayQuery($id: ID!) {
    node(id: $id) {
      ... on ScheduleRun {
        id
        executionId
        scheduleId
        status
        totalMachineCount
        respondedMachineCount
        dispatchedAt
        finishedAt
        initiator {
          id
          firstName
          lastName
          email
          status
          image {
            imageUrl
            hash
          }
        }
      }
    }
  }
`;
