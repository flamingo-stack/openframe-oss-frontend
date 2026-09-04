import { featureFlags } from '@/lib/feature-flags';

/**
 * Response names the escalation bodies are fetched under.
 *
 * `EscalationOfferData.text` and `TicketEscalatedData.text` are `String` while
 * `TextData`/`ThinkingData`/`SystemData.text` are `String!`, and GraphQL refuses
 * to merge same-named fields with different nullability into one selection set
 * (`FieldsConflict` — the WHOLE query is rejected, not just that fragment).
 * Aliasing gives each body its own response name.
 *
 * Everything downstream — the core lib's history decoder included — reads
 * `text`, so `normalizeMessageDataAliases` maps them back at the single
 * parse point. Change one of the two and you must change the other.
 */
export const OFFER_TEXT_ALIAS = 'offerText';
export const ESCALATED_TEXT_ALIAS = 'escalatedText';
/** `TicketEventData.reason` (`String`) vs `TicketEscalatedData.reason` — same
 *  merge hazard as the `text` fields above, same cure. */
export const TICKET_EVENT_REASON_ALIAS = 'ticketEventReason';

const MESSAGE_DATA_FIELD_ALIASES: Record<string, { alias: string; field: string }> = {
  ESCALATION_OFFER: { alias: OFFER_TEXT_ALIAS, field: 'text' },
  TICKET_ESCALATED: { alias: ESCALATED_TEXT_ALIAS, field: 'text' },
  TICKET_EVENT: { alias: TICKET_EVENT_REASON_ALIAS, field: 'reason' },
};

type RawMessageData = Record<string, unknown>;

/**
 * Undo the field aliases so persisted rows reach the core lib in the SAME
 * shape the live NATS chunk has. Untouched entries pass through by
 * reference — no copy, no reordering.
 */
export function normalizeMessageDataAliases<T>(messageData: T): T {
  if (!Array.isArray(messageData)) return messageData;
  let changed = false;
  const normalized = messageData.map(item => {
    if (!item || typeof item !== 'object') return item;
    const row = item as RawMessageData;
    const mapping = MESSAGE_DATA_FIELD_ALIASES[String(row.type)];
    if (!mapping || !(mapping.alias in row)) return item;
    changed = true;
    const { [mapping.alias]: body, ...rest } = row;
    return typeof body === 'string' && body ? { ...rest, [mapping.field]: body } : rest;
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
  // Gated on `ai-resolution` for the same reason as the escalation types:
  // `TicketEventData` ships with the ticket-resolution backend (the same flag
  // gates the assistant's closure tools server-side).
  const ticketEventFragment = featureFlags.aiResolution.enabled()
    ? `
            ... on TicketEventData {
              type
              kind
              actorId
              actorName
              actorType
              targetStatusKind
              ${TICKET_EVENT_REASON_ALIAS}: reason
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
            ${ticketEventFragment}
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
