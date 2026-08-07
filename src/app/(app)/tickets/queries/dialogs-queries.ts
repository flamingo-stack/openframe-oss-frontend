import { featureFlags } from '@/lib/feature-flags';

/**
 * Response names the escalation bodies are fetched under.
 *
 * `EscalationOfferData.text` and `TicketEscalatedData.text` are `String` while
 * `TextData`/`ThinkingData`/`SystemData.text` are `String!`, and GraphQL refuses
 * to merge same-named fields with different nullability into one selection set
 * (`FieldsConflict` — the WHOLE query is rejected, not just that fragment).
 * Aliasing gives each body its own response name. Mirrors `ASK_INTRO_ALIAS`.
 *
 * Everything downstream — the core lib's history decoder included — reads
 * `text`, so `normalizeEscalationMessageData` maps them back at the single
 * parse point. Change one of the two and you must change the other.
 */
export const OFFER_TEXT_ALIAS = 'offerText';
export const ESCALATED_TEXT_ALIAS = 'escalatedText';

const ESCALATION_TEXT_ALIASES: Record<string, string> = {
  ESCALATION_OFFER: OFFER_TEXT_ALIAS,
  TICKET_ESCALATED: ESCALATED_TEXT_ALIAS,
};

type RawMessageData = Record<string, unknown>;

/**
 * Undo the escalation body aliases so persisted rows reach the core lib in the
 * SAME shape the live NATS chunk has. Untouched entries pass through by
 * reference — no copy, no reordering.
 */
export function normalizeEscalationMessageData<T>(messageData: T): T {
  if (!Array.isArray(messageData)) return messageData;
  let changed = false;
  const normalized = messageData.map(item => {
    if (!item || typeof item !== 'object') return item;
    const row = item as RawMessageData;
    const alias = ESCALATION_TEXT_ALIASES[String(row.type)];
    if (!alias || !(alias in row)) return item;
    changed = true;
    const { [alias]: body, ...rest } = row;
    return typeof body === 'string' && body ? { ...rest, text: body } : rest;
  });
  return (changed ? normalized : messageData) as T;
}

export const GET_DIALOG_STATISTICS_QUERY = `
  query GetDialogStatistics {
    dialogStatistics {
      totalCount
      statusCounts {
        status
        count
      }
      averageResolutionTimeFormatted
      averageRating
    }
  }
`;

export function getDialogMessagesQuery() {
  // Gated on `ai-escalation`: these types ship with the escalation backend, and
  // a fragment on a type the schema doesn't declare fails validation for the
  // whole document — every message would come back empty, not just the block.
  const escalationFragments = featureFlags.aiEscalation.enabled()
    ? `
            ... on EscalationOfferData {
              type
              offerId
              state
              ${OFFER_TEXT_ALIAS}: text
              origin
              resolvedByName
            }

            ... on TicketEscalatedData {
              type
              ticketId
              ticketNumber
              reason
              ${ESCALATED_TEXT_ALIAS}: text
            }
`
    : '';
  return `
  query GetAllMessages($dialogId: ID!, $chatType: ChatType, $cursor: String, $limit: Int, $sortField: String, $sortDirection: SortDirection) {
    messages(
      dialogId: $dialogId
      chatType: $chatType
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
              }
            }
            ... on AssistantOwner {
              model
              providerName
            }
          }
          messageData {
            type
            ... on TextData {
              text
            }

            ... on ThinkingData {
              text
            }

            ... on SystemData {
              text
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

            ${escalationFragments}
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
