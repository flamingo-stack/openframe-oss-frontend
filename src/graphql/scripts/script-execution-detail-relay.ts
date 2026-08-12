import { graphql } from 'react-relay';

/**
 * Single script-execution query (v2). The schema has no `scriptExecution(id)`
 * field, so we resolve the node through the generic `node(id)` Relay entry point
 * and narrow to `ScriptExecution`. Feeds the execution-details page.
 */
export const scriptExecutionDetailRelayQuery = graphql`
  query scriptExecutionDetailRelayQuery($id: ID!) {
    node(id: $id) {
      ... on ScriptExecution {
        id
        executionId
        scriptId
        scriptName
        status
        # Backs the chip beside "Executed by", same as in the history lists.
        source
        privilegeLevel
        dispatchedAt
        statusChangedAt
        finishedAt
        executionTimeMs
        exitCode
        timedOut
        stdout
        stderr
        error
        machine {
          id
          machineId
          hostname
          displayName
          organization {
            id
            name
          }
        }
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
