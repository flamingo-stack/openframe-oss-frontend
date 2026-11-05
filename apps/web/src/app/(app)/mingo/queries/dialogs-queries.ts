const dialogsQuery = (extraNodeFields: string) => `
  query GetDialogs($filter: DialogFilterInput, $first: Int, $after: String, $search: String, $sort: SortInput) {
  dialogs(filter: $filter, first: $first, after: $after, search: $search, sort: $sort) {
   edges {
    cursor
    node {
     id
     dialogId
     title
     status
     streamState${extraNodeFields}
     createdAt
     statusUpdatedAt
     lastActivityAt
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

export const GET_MINGO_DIALOGS_QUERY = dialogsQuery('');

/**
 * The chat list: each chat's pending approval rides along, for the row status. Not
 * asked by the other lists (the archive, incidents), which need no row status.
 */
export const GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY = dialogsQuery(`
     pendingApproval {
      id
      approvalType
     }`);

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

export const COMPACT_MINGO_DIALOG_MUTATION = `
  mutation CompactDialog($input: DialogIdInput!) {
    compactDialog(input: $input) {
      userErrors { field message code }
    }
  }
`;

export const GET_MINGO_DIALOG_QUERY = `
  query GetDialog($id: ID!) {
    dialog(id: $id) {
    id
    dialogId
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
