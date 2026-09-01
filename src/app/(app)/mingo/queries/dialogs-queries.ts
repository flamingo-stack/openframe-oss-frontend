/**
 * Response name the ASK card's intro sentence is fetched under.
 *
 * `AskData.text` is `String` while `TextData`/`ThinkingData.text` are
 * `String!`, and GraphQL refuses to merge same-named fields with different
 * nullability into one selection set (`FieldsConflict` — the whole query is
 * rejected, not just that fragment). Aliasing gives the ask intro its own
 * response name, which is not merged with the others.
 *
 * Everything downstream — the core lib's history decoder included — reads
 * `text`, so `normalizeAskMessageData` maps it back at the single parse point.
 * Change one of the two and you must change the other.
 */
export const ASK_INTRO_ALIAS = 'askIntro';

type RawMessageData = Record<string, unknown>;

/**
 * Undo `ASK_INTRO_ALIAS` on a message's `messageData` list, so persisted ASK
 * rows reach the core lib in the SAME shape the live NATS chunk has
 * (`{ type, text, question, options }`). Non-ASK entries pass through by
 * reference — no copy, no reordering.
 */
export function normalizeAskMessageData<T>(messageData: T): T {
  if (!Array.isArray(messageData)) return messageData;
  let changed = false;
  const normalized = messageData.map(item => {
    if (!item || typeof item !== 'object') return item;
    const row = item as RawMessageData;
    if (row.type !== 'ASK' || !(ASK_INTRO_ALIAS in row)) return item;
    changed = true;
    const { [ASK_INTRO_ALIAS]: intro, ...rest } = row;
    return typeof intro === 'string' && intro ? { ...rest, text: intro } : rest;
  });
  return (changed ? normalized : messageData) as T;
}

export const GET_MINGO_DIALOGS_QUERY = `
  query GetDialogs($filter: DialogFilterInput, $pagination: CursorPaginationInput, $search: String) {
  dialogs(filter: $filter, pagination: $pagination, search: $search) {
   edges {
    cursor
    node {
     id
     title
     status
     createdAt
     statusUpdatedAt
     owner {
      type
      ... on AdminDialogOwner {
       userId
       user {
        id
        firstName
        lastName
        image {
         imageUrl
         hash
        }
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

export const RENAME_MINGO_DIALOG_MUTATION = `
  mutation RenameDialog($input: RenameDialogInput!) {
    renameDialog(input: $input) {
      dialog { id title }
      userErrors { field message }
    }
  }
`;

export const ARCHIVE_MINGO_DIALOG_MUTATION = `
  mutation ArchiveDialog($input: DialogIdInput!) {
    archiveDialog(input: $input) {
      dialog { id status }
      userErrors { field message }
    }
  }
`;

export const UNARCHIVE_MINGO_DIALOG_MUTATION = `
  mutation UnarchiveDialog($input: DialogIdInput!) {
    unarchiveDialog(input: $input) {
      dialog { id status }
      userErrors { field message }
    }
  }
`;

export const GET_MINGO_DIALOG_QUERY = `
  query GetDialog($id: ID!) {
    dialog(id: $id) {
    id
    title
    status
    streamState
    owner {
      type
      ... on AdminDialogOwner {
       userId
      }
      ... on ClientDialogOwner {
      machineId
      machine {
        id
        machineId
        hostname
       }
      }
    }
    createdAt
    statusUpdatedAt
    resolvedAt
    aiResolutionSuggestedAt
    rating {
      id
      dialogId
      createdAt
    }
    tokenUsage {
      chatType
      inputTokensSize
      outputTokensSize
      totalTokensSize
      contextSize
    }
    }
  }
`;

export function getMingoDialogMessagesQuery() {
  // Product-doc metadata and clarification cards are persisted separately from
  // the answer text. Fetch both so a reloaded V3 dialog renders like the live turn.
  // The ask intro is fetched under `ASK_INTRO_ALIAS`, not as `text` — see the
  // alias' doc-comment. `normalizeAskMessageData` undoes it on the way in.
  const guideModeFragment = `... on GuideData {
              payload
            }

            ... on AskData {
              ${ASK_INTRO_ALIAS}: text
              question
              options {
                label
                description
              }
            }`;

  return `
  query GetAllMessages($dialogId: ID!, $cursor: String, $limit: Int, $sortField: String, $sortDirection: SortDirection) {
    messages(
      dialogId: $dialogId
      pagination: { cursor: $cursor, limit: $limit }
      sort: { field: $sortField, direction: $sortDirection }
    ) {
      edges {
        cursor
        node {
          id
          dialogId
          chatType
          dialogMode
          createdAt
          lastChunkStreamSeq
          owner {
            type
            ... on AdminOwner {
              user {
                id
                firstName
                lastName
                image {
                  imageUrl
                  hash
                }
              }
            }
          }
          messageData {
            type
            ... on TextData {
              text
              contextItems {
                type
                id
              }
            }

            ... on ThinkingData {
              text
            }

            ${guideModeFragment}
            ... on ExecutingToolData {
              type
              integratedToolType
              toolFunction
              title
              toolExplanation
              parameters
              requiresApproval
              approvalStatus
              toolExecutionRequestId
            }

            ... on ExecutedToolData {
              type
              integratedToolType
              toolFunction
              result
              success
              requiredApproval
              approvalStatus
              toolExecutionRequestId
            }

            ... on ApprovalRequestData {
              type
              approvalRequestId
              approvalType
              command
              explanation
              toolCalls {
                toolExecutionRequestId
                toolName
                toolTitle
                toolExplanation
                toolType
                requiresApproval
                approvalType
                toolCallArguments
              }
            }

            ... on ApprovalResultData {
              type
              approvalRequestId
              approved
              approvalType
              resolvedByName
            }

            ... on ContextCompactionStartData {
              type
            }

            ... on ContextCompactionEndData {
              type
              summary
            }

            ... on ErrorData {
              error
              details
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
}
