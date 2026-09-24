'use client';

import type { DialogItem } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  ARCHIVE_MINGO_DIALOG_MUTATION,
  GET_MINGO_DIALOGS_QUERY,
  RENAME_MINGO_DIALOG_MUTATION,
  UNARCHIVE_MINGO_DIALOG_MUTATION,
} from '../queries/dialogs-queries';
import type { DialogsResponse } from '../types';
import { mingoDialogQueryKeys } from '../utils/query-keys';

interface DialogMutationPayload {
  dialog: { id: string } | null;
  userErrors: { message: string }[];
}

interface FetchArchivedParams {
  cursor?: string;
  limit?: number;
  search?: string;
}
interface FetchArchivedResult {
  dialogs: DialogItem[];
  nextCursor: string | null;
}

async function runDialogMutation(query: string, variables: Record<string, unknown>, key: string): Promise<void> {
  const response = await apiClient.post<{ data: Record<string, DialogMutationPayload> }>('/chat/graphql', {
    query,
    variables,
  });
  if (!response.ok || !response.data) {
    throw new Error(response.error || 'Request failed');
  }
  const payload = response.data.data[key];
  if (payload?.userErrors?.length) {
    throw new Error(payload.userErrors[0].message);
  }
}

// The backend summarizes inside the request, so the default 30s ceiling would
// report a failure for a compaction that is still running and then succeeds.
const COMPACT_TIMEOUT_MS = 5 * 60_000;

// Module-level, not a ref: the drawer unmounts on close, and a reopened drawer
// must still see a compaction that is in flight.
const compactingDialogIds = new Set<string>();

async function compactDialogContext(id: string): Promise<void> {
  const response = await apiClient.post(`/chat/api/v1/dialogs/${id}/compact`, undefined, {
    timeoutMs: COMPACT_TIMEOUT_MS,
  });
  if (response.status === 409) {
    throw new Error('Mingo is still working on this chat. Try again once it finishes.');
  }
  // No answer (timeout, dropped connection): the request may have reached the
  // server, which keeps compacting regardless.
  if (response.status === 0) {
    throw new Error("Couldn't confirm the compaction finished. It may still complete — check the chat in a moment.");
  }
  if (!response.ok) {
    throw new Error(response.error || 'Failed to compact chat memory');
  }
}

/**
 * Dialog rename / archive / unarchive / compact actions + the archived-dialog fetcher,
 * wired to the saas-ai-agent `/chat/graphql` endpoint. Rename/archive feed the
 * embeddable chat's row menu (via `mingoState`); fetchArchived/unarchive feed
 * the archive page (via `mingoDialogCapabilities`). Each mutation invalidates
 * the active dialog list so the change shows immediately.
 */
export function useMingoDialogActions() {
  const { toast, dismiss } = useToast();
  const queryClient = useQueryClient();

  const invalidateDialogs = useCallback(() => {
    // Archive/unarchive move a dialog between the active and archived lists, so
    // refresh BOTH cached queries — otherwise the archived-list cache (below)
    // would go stale after archiving/unarchiving.
    void queryClient.invalidateQueries({ queryKey: ['mingo-dialogs'] });
    void queryClient.invalidateQueries({ queryKey: ['mingo-archived-dialogs'] });
  }, [queryClient]);

  const renameDialog = useCallback(
    async (id: string, title: string) => {
      try {
        await runDialogMutation(RENAME_MINGO_DIALOG_MUTATION, { input: { id, title } }, 'renameDialog');
        invalidateDialogs();
        void queryClient.invalidateQueries({ queryKey: mingoDialogQueryKeys.detail(id) });
        toast({ title: 'Chat renamed', variant: 'success' });
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to rename chat',
          variant: 'destructive',
        });
      }
    },
    [invalidateDialogs, queryClient, toast],
  );

  const archiveDialog = useCallback(
    async (id: string) => {
      try {
        await runDialogMutation(ARCHIVE_MINGO_DIALOG_MUTATION, { input: { id } }, 'archiveDialog');
        invalidateDialogs();
        toast({ title: 'Chat archived', variant: 'success' });
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to archive chat',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [invalidateDialogs, toast],
  );

  const unarchiveDialog = useCallback(
    async (id: string) => {
      try {
        await runDialogMutation(UNARCHIVE_MINGO_DIALOG_MUTATION, { input: { id } }, 'unarchiveDialog');
        invalidateDialogs();
        toast({ title: 'Chat unarchived', variant: 'success' });
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to unarchive chat',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [invalidateDialogs, toast],
  );

  // The request returns once the summary is written; meanwhile the compaction
  // start/end chunks stream into the open thread over NATS. The messages cache is
  // refreshed for a dialog compacted from the list without being open.
  const compactDialog = useCallback(
    async (id: string) => {
      if (compactingDialogIds.has(id)) return;
      compactingDialogIds.add(id);
      const progressToastId = toast({ title: 'Compacting chat memory…', duration: Infinity });
      try {
        await compactDialogContext(id);
        void queryClient.invalidateQueries({ queryKey: mingoDialogQueryKeys.messages(id) });
        toast({ title: 'Chat memory compacted', variant: 'success' });
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to compact chat memory',
          variant: 'destructive',
        });
      } finally {
        compactingDialogIds.delete(id);
        dismiss(progressToastId);
      }
    },
    [dismiss, queryClient, toast],
  );

  const fetchArchivedDialogs = useCallback(
    async (params: FetchArchivedParams): Promise<FetchArchivedResult> => {
      const runFetch = async (): Promise<FetchArchivedResult> => {
        const response = await apiClient.post<DialogsResponse>('/chat/graphql', {
          query: GET_MINGO_DIALOGS_QUERY,
          variables: {
            filter: { agentTypes: ['ADMIN'], statuses: ['ARCHIVED'] },
            pagination: { limit: params.limit ?? 20, cursor: params.cursor },
            search: params.search,
          },
        });
        if (!response.ok || !response.data) {
          throw new Error(response.error || 'Failed to fetch archived chats');
        }
        const { edges, pageInfo } = response.data.data.dialogs;
        return {
          dialogs: edges.map(edge => ({
            id: edge.node.id,
            title: edge.node.title || 'New Chat',
            timestamp: new Date(edge.node.createdAt),
          })),
          nextCursor: pageInfo.hasNextPage ? (pageInfo.endCursor ?? null) : null,
        };
      };

      // Cache the FIRST page (no cursor) in the root QueryClient so reopening
      // the archive — even after the drawer unmounted — returns instantly
      // without a network round-trip or a skeleton. Paginated pages (cursor
      // set) stay transient. Invalidated on archive/unarchive above.
      if (!params.cursor) {
        return queryClient.fetchQuery({
          queryKey: ['mingo-archived-dialogs', { search: params.search, limit: params.limit ?? 20 }],
          queryFn: runFetch,
          staleTime: 5 * 60 * 1000,
          gcTime: 30 * 60 * 1000,
        });
      }
      return runFetch();
    },
    [queryClient],
  );

  return { renameDialog, archiveDialog, unarchiveDialog, compactDialog, fetchArchivedDialogs };
}
