import { graphql } from 'react-relay';

/**
 * The work time table's page and the stats above it (`WorkTimeTable`). One page of entries per request, its cursor in
 * the URL (`cursor`, or under the host's prefix): no `@connection`, so a cursor from a link reads exactly its page.
 * `employeeTimeEntries` pages forward only (`first` / `after`). The stats ride along: a page move asks for them again
 * with the same filter (the same answer).
 */
export const employeeWorkTimeRelayQuery = graphql`
  query employeeWorkTimeRelayQuery($filter: TimeEntryFilterInput, $search: String, $first: Int!, $after: String) {
    employeeTimeStats(filter: $filter) {
      todayTotalSeconds
      todayEntryCount
      periodTotalSeconds
      periodEntryCount
      averagePerDaySeconds
    }
    employeeTimeEntries(filter: $filter, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          ...timeEntryFields_timeEntry @relay(mask: false)
          user {
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
          organization {
            id
            organizationId
            name
            image {
              imageUrl
              hash
            }
            contactInformation {
              contacts {
                email
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;
