import { graphql } from 'react-relay';

/**
 * The per-row field set both notification lists render — the header drawer
 * (unread only) and the full `/notifications` section.
 *
 * The two documents differ only in their arguments; the node selection is the
 * same, and it was written out twice before, which meant a new context type had
 * to be added in both places or the drawer would silently render a row the
 * section could navigate from. Spreading one fragment makes that structural, and
 * `mapNotificationNode` reads a generated type instead of a hand-written mirror
 * of what the two documents happened to select.
 *
 * `context` is a union: Relay flattens the inline fragments into one object
 * keyed by `__typename`, which is exactly what the mapper switches on.
 *
 * `@inline` because the consumer is `mapNotificationNode`, a plain function
 * feeding the core lib's notification components — not a component of its own.
 */
export const notificationFieldsFragment = graphql`
  fragment notificationFields_notification on Notification @inline {
    id
    severity
    title
    description
    createdAt
    read
    category
    context {
      __typename
      type
      ... on AdminAiMessageContext {
        dialogId
      }
      ... on AdminAiTicketMessageContext {
        ticketId
        dialogId
      }
      ... on TicketStatusChangedContext {
        ticketId
      }
      # dialogId is deliberately NOT selected: the wire declares it nullable while
      # the message contexts declare dialogId: ID!, and same-named fields of
      # different nullability cannot merge into one selection set. Navigation
      # needs only ticketId.
      ... on TicketReopenedContext {
        ticketId
      }
      ... on TicketAssignedContext {
        ticketId
      }
      ... on CustomerMessagePublishedContext {
        ticketId
      }
      ... on AdminMessagePublishedContext {
        ticketId
      }
      ... on AdminApprovalRequestContext {
        approvalRequestId
        dialogId
        approvalTicketId: ticketId
        approvalType
        resolution
        resolvedByName
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
    }
  }
`;
