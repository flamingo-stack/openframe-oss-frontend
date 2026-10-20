import {
  isMissingPendingApprovalError,
  notePendingApprovalUnsupported,
  pendingApprovalSupported,
} from '@/app/(app)/mingo/utils/pending-approval-support';
import { API_ENDPOINTS } from '@/app/(app)/tickets/constants';
import { extractGraphQlData, type GraphQlResponse } from '@/app/(app)/tickets/utils/graphql';
import { apiClient } from '@/lib/api-client';

/**
 * The Mingo chats that wait on an approval, for the Needs approval page: every admin's
 * (approval notifications go to all active admins, so any of them may decide), each with
 * its pending request and the tool calls it would run. `ACTIVE` as well as
 * `ACTION_REQUIRED`: a chat whose request waits can stay `ACTIVE` (seen on the 4016
 * tenant), and there is no `pendingApproval` filter — the inbox keeps the chats that have
 * one (BACKEND_ASKS #9).
 *
 * `/chat/graphql`, the saas-ai-agent's schema — raw POST by the app's rule for that
 * service. `Dialog.pendingApproval` is the same `PendingApproval` type the tickets lane
 * selects, so a backend serving the chat list's `pendingApproval` serves this too.
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
    }
  }
`;

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
}

interface ApprovalDialogsData {
  dialogs: {
    edges: Array<{ node: ApprovalDialogNode }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  };
}

/** What a backend without `Dialog.pendingApproval` answers: no chat is known to wait. */
const NO_APPROVAL_DIALOGS: ApprovalDialogsPage = { dialogs: [], pageInfo: { hasNextPage: false } };

export async function fetchApprovalDialogs(after: string | undefined): Promise<ApprovalDialogsPage> {
  // Without the field the query cannot ask anything (`pending-approval-support.ts`).
  if (!pendingApprovalSupported()) return NO_APPROVAL_DIALOGS;
  try {
    return await fetchApprovalDialogsPage(after);
  } catch (error) {
    if (!isMissingPendingApprovalError(error)) throw error;
    notePendingApprovalUnsupported();
    return NO_APPROVAL_DIALOGS;
  }
}

async function fetchApprovalDialogsPage(after: string | undefined): Promise<ApprovalDialogsPage> {
  const response = await apiClient.post<GraphQlResponse<ApprovalDialogsData>>(API_ENDPOINTS.GRAPHQL, {
    query: APPROVAL_DIALOGS_QUERY,
    variables: {
      filter: { agentTypes: ['ADMIN'], statuses: ['ACTION_REQUIRED', 'ACTIVE'], scope: 'ALL' },
      first: APPROVAL_DIALOGS_PAGE_SIZE,
      after,
    },
  });
  const { edges, pageInfo } = extractGraphQlData(response).dialogs;
  return { dialogs: edges.map(edge => edge.node), pageInfo };
}
