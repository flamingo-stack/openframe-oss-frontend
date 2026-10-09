/**
 * Response name the ASK card's intro sentence is fetched under.
 *
 * `AskData.text` is `String` while `TextData`/`ThinkingData`/`SystemData.text`
 * are `String!`, and GraphQL's SameResponseShape rule refuses to merge
 * same-named fields with different nullability into one selection set — the
 * WHOLE query is rejected, not just that fragment. An alias gives the ask intro
 * its own response name, which is never merged with the others.
 *
 * Everything downstream — the core lib's history decoder included — reads
 * `text`, so `normalizeAskMessageData` maps it back at the single parse point.
 * Change one of the two and you must change the other; the pair is pinned
 * together in `dialogs-queries.test.ts`.
 */
export const ASK_INTRO_ALIAS = 'askIntro';

/**
 * Undo `ASK_INTRO_ALIAS` on one persisted `messageData` row, so an ASK reaches
 * the core lib in the SAME shape the live NATS chunk carries
 * (`{ type, text, question, options }`).
 *
 * Returns the row BY REFERENCE when there is nothing to rename — the caller
 * uses that identity to avoid copying a page of history it did not change.
 */
function normalizeAskRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row;
  const fields = row as Record<string, unknown>;
  if (fields.type !== 'ASK' || !(ASK_INTRO_ALIAS in fields)) return row;

  const { [ASK_INTRO_ALIAS]: intro, ...rest } = fields;
  // A null intro is DROPPED rather than written back as `text: null`: the live
  // chunk simply omits it, and the two shapes have to stay identical.
  return typeof intro === 'string' && intro ? { ...rest, text: intro } : rest;
}

/**
 * `normalizeAskRow` over a message's `messageData`, which the chat service sends
 * as either a single object or a list.
 */
export function normalizeAskMessageData<T>(messageData: T): T {
  if (!Array.isArray(messageData)) return normalizeAskRow(messageData) as T;

  let changed = false;
  const normalized = messageData.map(row => {
    const next = normalizeAskRow(row);
    if (next !== row) changed = true;
    return next;
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
     streamState
     pendingApproval {
      id
      approvalType
     }
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

/**
 * An answer's attachments (cited sources, videos, cards), persisted in their own
 * row beside the answer text. Selected field for field as the live `ATTACHMENTS`
 * chunk carries them: the core lib decodes both through one function, so a
 * reloaded dialog renders exactly what the live turn did.
 */
const ATTACHMENTS_FRAGMENT = `... on AttachmentsData {
              sources {
                index
                name
                path
                documentType
                externalUrl
                targetPlatform
                id
                sourceRepo
                items {
                  id
                  name
                  path
                  documentType
                  externalUrl
                  targetPlatform
                }
              }
              videos {
                ref
                type
                sourceRepo
                id
                title
                url
                metadata {
                  videoUrl
                  youtubeUrl
                  parentDocType
                  parentDocId
                }
              }
              cards {
                ref
                entityType
                entityId
              }
            }`;

/**
 * What a backend from before saas-tenant#3633 has in place of `AttachmentsData`
 * (see `fetchMingoDialogMessages`). `GuideData.text` is NOT selected:
 * payload-only records persist it as an empty string, which would replay as an
 * empty text segment.
 */
const LEGACY_GUIDE_FRAGMENT = `... on GuideData {
              payload
            }`;

export function getMingoDialogMessagesQuery({ legacyGuide = false }: { legacyGuide?: boolean } = {}) {
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

            ${legacyGuide ? LEGACY_GUIDE_FRAGMENT : ATTACHMENTS_FRAGMENT}

            ... on AskData {
              ${ASK_INTRO_ALIAS}: text
              question
              options {
                label
                description
              }
            }

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
