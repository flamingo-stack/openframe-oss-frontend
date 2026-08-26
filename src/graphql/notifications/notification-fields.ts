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
 * Two shapes of the same facts are selected side by side, and `mapNotificationNode`
 * reads exactly one of them — whichever the `notifications-legacy-path` lever selects:
 *
 * 1. `type` + `attributes` — the spec-catalog contract (flat `string -> string` map),
 *    read by default. Entity ids live under fixed keys regardless of the type, so a type
 *    this release has never heard of still navigates and auto-reads.
 * 2. `context` — the legacy typed union, read when the lever is on. Kept because it is
 *    what the backend still writes until the spec path ships, and what it writes again if
 *    the `notifications.legacy-path` kill-switch is flipped back on. Rows written before
 *    the backfill migration carry only this.
 *
 * Both are selected here even though only one is read, because the lever is a runtime
 * value and flipping it must not need a new query. Neither is guaranteed on the wire:
 * `context` is nullable on the new path, `type`/`attributes` are null on legacy rows —
 * and since the read is exclusive, a row carrying only the unselected shape maps without
 * type or entity ids rather than falling back (see `mapNotificationNode`).
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
    type
    attributes
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
      # ticketId is aliased: nullable ID on this context (a Fae chat can run without
      # a ticket) cannot merge with the ID! selections above. The mapper folds it
      # into meta.ticketId for ticket navigation.
      ... on ClientAiMessageContext {
        dialogId
        clientTicketId: ticketId
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
      ... on TicketEscalatedByUserContext {
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
