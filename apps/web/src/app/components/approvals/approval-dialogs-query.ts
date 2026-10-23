import { API_ENDPOINTS } from '@/app/(app)/tickets/constants';
import { extractGraphQlData, type GraphQlResponse } from '@/app/(app)/tickets/utils/graphql';
import { apiClient } from '@/lib/api-client';

/**
 * The Mingo chats that wait on an approval, for the Needs approval page: every admin's
 * (approval notifications go to all active admins, so any of them may decide), each with
 * its pending request and the tool calls it would run. The server keeps only the chats
 * with a pending request (`hasPendingApproval`); the statuses are the open ones, since
 * with no status the backend also returns archived chats.
 *
 * `/chat/graphql`, the saas-ai-agent's schema — raw POST by the app's rule for that
 * service. `Dialog.pendingApproval` is the same `PendingApproval` type the tickets lane
 * selects.
 */
export const APPROVAL_DIALOGS_QUERY = `
  query GetApprovalDialogs($filter: DialogFilterInput, $first: Int, $after: String) {
    dialogs(filter: $filter, first: $first, after: $after) {
      edges {
        node {
          id
          dialogId
          title
          createdAt
          pendingApproval {
            id
            approvalType
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
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      filteredCount
    }
  }
`;

/** How many chats wait on an approval: the sidebar badge's share of the chat service. */
export const APPROVAL_DIALOGS_COUNT_QUERY = `
  query GetApprovalDialogsCount($filter: DialogFilterInput) {
    dialogs(filter: $filter, first: 1) {
      filteredCount
    }
  }
`;

/** Every admin's open chats that wait on an approval request. */
export const APPROVAL_DIALOGS_FILTER = {
  agentTypes: ['ADMIN'],
  statuses: ['ACTION_REQUIRED', 'ACTIVE', 'ON_HOLD'],
  scope: 'ALL',
  hasPendingApproval: true,
} as const;

/**
 * Under the chat lists' `['mingo-dialogs']` prefix on purpose: renaming, archiving and
 * creating a chat invalidate that prefix, so a renamed chat's card retitles and an
 * archived one leaves. Not under `['mingo-dialogs', 'list']`: the writers of the chat
 * list's pages match that key, and these pages have another shape.
 */
export const APPROVAL_DIALOGS_QUERY_KEY = ['mingo-dialogs', 'approvals'] as const;

export const APPROVAL_DIALOGS_PAGE_SIZE = 20;

export interface ApprovalDialogNode {
  /** Relay global id. */
  id: string;
  /** Raw dialog id: what notifications, routes and the chat state use. */
  dialogId: string;
  title: string | null;
  createdAt: string;
  pendingApproval: {
    id: string;
    approvalType?: string | null;
    explanation?: string | null;
    createdAt?: string | null;
    toolCalls?: readonly unknown[] | null;
  } | null;
}

export interface ApprovalDialogsPage {
  dialogs: ApprovalDialogNode[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  /** Every chat waiting on an approval, across all pages. */
  filteredCount: number;
}

interface ApprovalDialogsData {
  dialogs: {
    edges: Array<{ node: ApprovalDialogNode }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
    filteredCount: number;
  };
}

interface ApprovalDialogsCountData {
  dialogs: { filteredCount: number };
}

export async function fetchApprovalDialogs(after: string | undefined): Promise<ApprovalDialogsPage> {
  const response = await apiClient.post<GraphQlResponse<ApprovalDialogsData>>(API_ENDPOINTS.GRAPHQL, {
    query: APPROVAL_DIALOGS_QUERY,
    variables: { filter: APPROVAL_DIALOGS_FILTER, first: APPROVAL_DIALOGS_PAGE_SIZE, after },
  });
  const { edges, pageInfo, filteredCount } = extractGraphQlData(response).dialogs;
  return { dialogs: edges.map(edge => edge.node), pageInfo, filteredCount };
}

export async function fetchApprovalDialogsCount(): Promise<number> {
  const response = await apiClient.post<GraphQlResponse<ApprovalDialogsCountData>>(API_ENDPOINTS.GRAPHQL, {
    query: APPROVAL_DIALOGS_COUNT_QUERY,
    variables: { filter: APPROVAL_DIALOGS_FILTER },
  });
  return extractGraphQlData(response).dialogs.filteredCount;
}
