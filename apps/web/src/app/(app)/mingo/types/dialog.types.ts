import type { GraphQlResponse } from '../../tickets/utils/graphql';

// GraphQL response types
export interface DialogTokenUsage {
  chatType: string;
  inputTokensSize: number | null;
  outputTokensSize: number | null;
  totalTokensSize: number | null;
  contextSize: number | null;
}

export type DialogStreamState = 'IDLE' | 'STREAMING';

export interface DialogNode {
  /** Relay global id. Use `dialogId` for anything outside GraphQL. */
  id: string;
  /** Raw dialog id: NATS subjects, notifications, REST, `?mingoDialog=`. */
  dialogId: string;
  title: string;
  status: string;
  streamState: DialogStreamState;
  /** The approval request the dialog waits on; null when none is pending. */
  pendingApproval?: { id: string; approvalType?: string } | null;
  /** DialogOwner union — ClientDialogOwner (machine fields) or AdminDialogOwner
   *  (userId/user fields), depending on the query's inline fragments. */
  owner?: {
    type?: 'CLIENT' | 'ADMIN';
    machineId?: string;
    machine?: {
      id: string;
      machineId: string;
      hostname: string;
      organizationId: string;
    };
    userId?: string;
    user?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      image?: {
        imageUrl?: string | null;
        hash?: string | null;
      } | null;
    } | null;
  };
  createdAt: string;
  statusUpdatedAt?: string;
  resolvedAt?: string;
  aiResolutionSuggestedAt?: string;
  rating?: {
    id: string;
    dialogId: string;
    createdAt: string;
  };
  tokenUsage?: DialogTokenUsage[] | null;
}

export interface DialogEdge {
  cursor: string;
  node: DialogNode;
}

export interface DialogConnection {
  edges: DialogEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

export type DialogsResponse = GraphQlResponse<{ dialogs: DialogConnection }>;

/** The `dialog(id:)` envelope. `dialog` is `null` when the id resolves to
 *  nothing this user can open — the `mingo-dialog` queryFn tells that apart
 *  from a failure. */
export type DialogResponse = GraphQlResponse<{ dialog: DialogNode | null }>;

// Hook options
export interface UseMingoDialogsOptions {
  enabled?: boolean;
  search?: string;
  limit?: number;
  /** Ownership scope: 'my' keeps only the signed-in admin's dialogs.
   *  Server-side — maps to the `DialogFilterInput.scope` ChatScope enum. */
  scope?: 'my' | 'all';
}
