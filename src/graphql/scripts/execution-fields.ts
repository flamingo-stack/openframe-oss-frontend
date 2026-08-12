import { graphql } from 'react-relay';

/**
 * The per-row field set every Execution History list renders — the per-script
 * tab, the per-schedule tab and the Schedule Run Details page.
 *
 * One fragment rather than the same selection written out per operation: all
 * three feed `toUiExecution` and the same shared table, so they must select the
 * same fields. Spreading one fragment makes that structural instead of a
 * convention three documents are trusted to follow — and it is what lets the
 * mapper take a generated type instead of a hand-written one describing what the
 * operations happen to select.
 *
 * `scriptName` is deliberately NOT here: it is the second line under the
 * initiator, and only the schedule lists want it (a schedule runs several
 * scripts; on a script's own page it would repeat the page title). Those two
 * select it beside this spread and pass it to `toUiExecution`.
 *
 * `@inline` because the consumer is `toUiExecution`, a plain function that
 * flattens a row into what the table renders — not a component. `readInlineData`
 * is how a fragment's data is read outside React; without it the spread would
 * hand back an opaque fragment reference and every row would need its own
 * `useFragment` component.
 */
export const executionFieldsFragment = graphql`
  fragment executionFields_execution on ScriptExecution @inline {
    id
    executionId
    status
    dispatchedAt
    # Where the run was triggered from, stamped server-side at dispatch. Backs
    # the chip beside the initiator: SCHEDULED and AI_ASSISTANT each get one,
    # MANUAL rows read as they always did.
    source
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
`;
