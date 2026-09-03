import { featureFlags } from '@/lib/feature-flags';

// Ticket GraphQL queries and mutations (openframe-saas-ai-agent service via /chat/graphql)

export const CREATE_TICKET_MUTATION = `
  mutation CreateTicket($input: CreateTicketInput!) {
    createTicket(input: $input) {
      ticket {
        id
        ticketNumber
        title
        description
        status
        owner {
          ... on ClientTicketOwner {
            type
            machineId
          }
          ... on AdminTicketOwner {
            type
            userId
          }
        }
        deviceId
        deviceHostname
        organizationId
        organizationName
        assignedTo
        assignedName
        tags {
          id
          key
          color
        }
        attachments {
          id
          ticketId
          fileName
          contentType
          fileSize
          uploadedAt
          uploadedBy
        }
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CREATE_TEMP_ATTACHMENT_UPLOAD_URL = `
  mutation CreateTempAttachmentUploadUrl($input: CreateTempAttachmentInput!) {
    createTempAttachmentUploadUrl(input: $input) {
      tempAttachment {
        id
        fileName
        contentType
        fileSize
        uploadUrl
        createdAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DELETE_TEMP_ATTACHMENT = `
  mutation DeleteTempAttachment($input: DeleteByIdInput!) {
    deleteTempAttachment(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

export const DELETE_TICKET_ATTACHMENT = `
  mutation DeleteTicketAttachment($input: DeleteByIdInput!) {
    deleteTicketAttachment(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_TICKET_QUERY = `
  query GetTicket($id: ID!) {
    ticket(id: $id) {
      id
      ticketNumber
      title
      description
      status
      statusDefinition {
        id
        name
        color
        kind
      }
      availableTransitions {
        id
        name
        color
      }
      creationSource
      owner {
        ... on ClientTicketOwner {
          type
          machineId
          machine {
            id
            machineId
            hostname
            organizationId
          }
        }
        ... on AdminTicketOwner {
          type
          userId
          user {
            id
            firstName
            lastName
          }
        }
      }
      deviceId
      deviceHostname
      organizationId
      organizationName
      organizationImage {
        imageUrl
        hash
      }
      assignedTo
      assignedName
      assigneeImage {
        imageUrl
        hash
      }
      tags {
        id
        key
        color
      }
      dialog {
        id
        currentMode
        tokenUsage {
          chatType
          inputTokensSize
          outputTokensSize
          totalTokensSize
          contextSize
        }
      }
      attachments {
        id
        ticketId
        fileName
        contentType
        fileSize
        uploadedAt
        uploadedBy
      }
      notes {
        id
        ticketId
        content
        authorId
        author {
          id
          firstName
          lastName
        }
        authorImage {
          imageUrl
          hash
        }
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
      resolvedAt
      order
    }
  }
`;

export const GET_TICKETS_QUERY = `
  query GetTickets($filter: TicketFilterInput, $pagination: CursorPaginationInput, $search: String) {
    tickets(filter: $filter, pagination: $pagination, search: $search, sort: { field: "order", direction: ASC }) {
      edges {
        cursor
        node {
          id
          ticketNumber
          title
          status
          statusDefinition {
            id
            name
            color
            kind
          }
          owner {
            ... on ClientTicketOwner {
              type
              machineId
              machine {
                id
                machineId
                hostname
                organizationId
              }
            }
            ... on AdminTicketOwner {
              type
              userId
              user {
                id
                firstName
                lastName
              }
            }
          }
          deviceId
          deviceHostname
          organizationId
          organizationName
          organizationImage {
            imageUrl
            hash
          }
          assignedTo
          assignedName
          assigneeImage {
            imageUrl
            hash
          }
          tags {
            id
            key
            color
          }
          # Unflagged, so it must not outrun the backend — see boardCardTicketFragment.
          unreadNotificationCount
          createdAt
          updatedAt
          resolvedAt
          order
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      filteredCount
    }
  }
`;

// ===== Lifecycle board (custom statuses) =====

/**
 * `escalatedByUser` ships with the escalation backend, so it rides the
 * `ai-escalation` flag: a field the server's schema does not declare fails
 * validation for the entire document, and `extractGraphQlData` throws on the
 * first GraphQL error — every board column would come back empty rather than
 * merely missing a badge. `resolvedBy` rides the `ai-resolution` flag for the
 * same reason.
 *
 * `unreadNotificationCount` is selected UNCONDITIONALLY and carries that same
 * failure mode, because `ticket.graphqls` declares it with no feature flag —
 * there is no flag to ride, and borrowing an unrelated one (`notifications`
 * gates the notifications UI, not the ai-agent schema) would only move the
 * breakage. It is therefore a deploy-ordering requirement: the saas-ai-agent
 * carrying the field must ship BEFORE this frontend, or the board columns, the
 * tickets table and the ticket picker (`use-ticket-options.ts`, same document)
 * all come back empty. Same constraint at the `GET_TICKETS_QUERY` selection.
 */
const boardCardTicketFragment = () => `
  fragment BoardCardTicket on Ticket {
    id
    ticketNumber
    title
    status
    statusDefinition {
      id
      name
      color
    }
    availableTransitions {
      id
      name
      color
    }
    dialog {
      id
      currentMode
    }
    owner {
      ... on ClientTicketOwner {
        type
        machineId
        machine {
          id
          machineId
          hostname
          organizationId
        }
      }
      ... on AdminTicketOwner {
        type
        userId
        user {
          id
          firstName
          lastName
        }
      }
    }
    deviceId
    deviceHostname
    organizationId
    organizationName
    assignedTo
    assignedName
    assigneeImage {
      imageUrl
      hash
    }
    tags {
      id
      key
      color
    }
    unreadNotificationCount
    ${featureFlags.aiEscalation.enabled() ? 'escalatedByUser' : ''}
    ${featureFlags.aiResolution.enabled() ? 'resolvedBy' : ''}
    pendingApproval {
      id
      approvalType
      command
      explanation
      createdAt
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
    createdAt
    updatedAt
    resolvedAt
    order
  }
`;

export const getBoardColumnTicketsQuery = () => `
  query GetBoardColumnTickets($statusId: ID!, $limit: Int!, $cursor: String, $search: String, $organizationIds: [ID!], $assigneeIds: [ID!], $tagIds: [ID!]) {
    tickets(
      filter: { statusIds: [$statusId], organizationIds: $organizationIds, assigneeIds: $assigneeIds, tagIds: $tagIds }
      pagination: { limit: $limit, cursor: $cursor }
      search: $search
      sort: { field: "order", direction: ASC }
    ) {
      edges {
        cursor
        node {
          ...BoardCardTicket
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      filteredCount
    }
  }
  ${boardCardTicketFragment()}
`;

export const GET_TICKET_STATUS_TRANSITION_RULES_QUERY = `
  query TicketStatusTransitionRules {
    ticketStatusTransitionRules {
      from {
        id
      }
      to {
        id
      }
    }
  }
`;

export const TRANSITION_TICKET_MUTATION = `
  mutation TransitionTicket($input: TransitionTicketInput!) {
    transitionTicket(input: $input) {
      ticket {
        id
        status
        statusDefinition {
          id
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_TICKET_TAGS_QUERY = `
  query TicketTags {
    ticketTags {
      id
      key
      description
      color
      createdAt
      createdBy
    }
  }
`;

export const GET_TICKET_ATTACHMENT_DOWNLOAD_URL = `
  query TicketAttachmentDownloadUrl($attachmentId: ID!) {
    ticketAttachmentDownloadUrl(attachmentId: $attachmentId)
  }
`;

export const ADD_TICKET_NOTE_MUTATION = `
  mutation AddTicketNote($input: AddTicketNoteInput!) {
    addTicketNote(input: $input) {
      note {
        id
        ticketId
        content
        authorId
        author {
          id
          firstName
          lastName
        }
        authorImage {
          imageUrl
          hash
        }
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_TICKET_NOTE_MUTATION = `
  mutation UpdateTicketNote($input: UpdateTicketNoteInput!) {
    updateTicketNote(input: $input) {
      note {
        id
        ticketId
        content
        authorId
        author {
          id
          firstName
          lastName
        }
        authorImage {
          imageUrl
          hash
        }
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DELETE_TICKET_NOTE_MUTATION = `
  mutation DeleteTicketNote($input: DeleteByIdInput!) {
    deleteTicketNote(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_TICKET_MUTATION = `
  mutation UpdateTicket($input: UpdateTicketInput!) {
    updateTicket(input: $input) {
      ticket {
        id
        ticketNumber
        title
        description
        status
        owner {
          ... on ClientTicketOwner {
            type
            machineId
          }
          ... on AdminTicketOwner {
            type
            userId
          }
        }
        deviceId
        deviceHostname
        organizationId
        organizationName
        assignedTo
        assignedName
        tags {
          id
          key
          color
        }
        attachments {
          id
          ticketId
          fileName
          contentType
          fileSize
          uploadedAt
          uploadedBy
        }
        createdAt
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * The reopen verb (ClickUp 86ajnyctz): flips a Resolved/Archived ticket back
 * open, records the optional reason (backend trims, <=1000 chars), and fires
 * the TICKET_EVENT chat card + the TICKET_REOPENED notification. Idempotent:
 * on an already-open ticket it returns success with the current kind.
 * `targetStatusKind` is the kind-token the backend reopened into
 * (AI_ASSISTANCE / TECH_REQUIRED / ...), same vocabulary as the chat event.
 */
export const REQUEST_TICKET_REOPEN_MUTATION = `
  mutation RequestTicketReopen($input: TicketReopenInput!) {
    requestTicketReopen(input: $input) {
      ticketId
      targetStatusKind
      userErrors { field message }
    }
  }
`;

export const REORDER_TICKET_MUTATION = `
  mutation ReorderTicket($input: ReorderTicketInput!) {
    reorderTicket(input: $input) {
      ticket { id status order }
      userErrors { field message }
    }
  }
`;

export const ASSIGN_TICKET_MUTATION = `
  mutation AssignTicket($input: AssignTicketInput!) {
    assignTicket(input: $input) {
      ticket { id assignedTo assignedName }
      userErrors { field message }
    }
  }
`;

// Atomic take-over: transition + assign + switch (or create) the client
// dialog in DIRECT mode in one backend transaction. An invalid transition
// comes back as a userError, like transitionTicket.
export const TAKE_OVER_TICKET_MUTATION = `
  mutation TakeOverTicket($input: TakeOverTicketInput!) {
    takeOverTicket(input: $input) {
      ticket {
        id
        status
        statusDefinition { id name color kind }
        assignedTo
        assignedName
      }
      userErrors { field message }
    }
  }
`;

export const UNASSIGN_TICKET_MUTATION = `
  mutation UnassignTicket($input: TicketIdInput!) {
    unassignTicket(input: $input) {
      ticket { id }
      userErrors { field message }
    }
  }
`;

export const UNLINK_DEVICE_FROM_TICKET_MUTATION = `
  mutation UnlinkDeviceFromTicket($input: TicketIdInput!) {
    unlinkDeviceFromTicket(input: $input) {
      ticket { id deviceId deviceHostname }
      userErrors { field message }
    }
  }
`;

export const UNLINK_ORGANIZATION_FROM_TICKET_MUTATION = `
  mutation UnlinkOrganizationFromTicket($input: TicketIdInput!) {
    unlinkOrganizationFromTicket(input: $input) {
      ticket { id organizationId organizationName }
      userErrors { field message }
    }
  }
`;

export const GET_TICKET_STATISTICS_QUERY = `
  query GetTicketStatistics {
    ticketStatistics {
      totalCount
      statusCounts {
        status
        count
      }
      statusDefinitionCounts {
        status {
          kind
          color
        }
        count
      }
      averageResolutionTimeFormatted
      averageRating
    }
  }
`;

export const ARCHIVE_RESOLVED_TICKETS_MUTATION = `
  mutation ArchiveResolvedTickets($filter: TicketFilterInput) {
    archiveResolvedTickets(filter: $filter) {
      count
      userErrors {
        field
        message
      }
    }
  }
`;
