'use client';

import {
  type ChatMessage,
  type ChatToolPart,
  mingoUserText,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import type { ChatContextItem } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  extractPendingApprovals,
  findLatestPendingApprovalId,
  isCompactingTail,
  stripPendingApprovals,
} from '@/lib/chat-history';
import { adminDisplayName, makeChatRowId } from '@/lib/chat-stream-thread';
import { appendImageHash, getFullImageUrl } from '@/lib/image-url';
import { selectUser, useAuthStore } from '@/stores';
import type { MessageListRef, MessagePageRef } from '../../tickets/services/ticket-service.types';
import { textForMingoBackend } from '../queries/fetch-dialog-messages';
import {
  type CreateMingoDialogOptions,
  useCreateDialogMutation,
  useSendMessageMutation,
  useStopGenerationMutation,
} from '../services/mingo-api-service';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import { insertNewDialog, raiseDialog } from '../utils/insert-new-dialog';
import { mingoDialogQueryKeys } from '../utils/query-keys';

/** Context attached to an outgoing message: the picker selection plus the
 *  current navigation context (resolved by the caller from the context store).
 *  `openView`/`recentViews` carry the minimal `{ type, id }` wire shape;
 *  `currentPage`/`currentList` are the page the message was sent from. */
export interface MingoSendContext {
  contextItems?: ChatContextItem[];
  openView?: { type: string; id: string } | null;
  recentViews?: Array<{ type: string; id: string }>;
  currentPage?: MessagePageRef;
  currentList?: MessageListRef;
}

interface UseMingoDialogChat {
  // Messages
  messages: ChatMessage[];
  isLoading: boolean;

  // Actions
  /** `insightId` lists the chat under an incident; `intent` opens it to create one entity;
   *  `title` lists it under the name its caller is about to give it. */
  createDialog: (options?: CreateMingoDialogOptions & { title?: string }) => Promise<string | null>;
  sendMessage: (content: string, targetDialogId?: string, context?: MingoSendContext) => Promise<boolean>;
  stopGeneration: () => Promise<void>;

  // Approval system
  approvals: ChatToolPart[];

  // State
  isCreatingDialog: boolean;
  isTyping: boolean;
  isCompacting: boolean;
  assistantType: 'mingo';
}

/** JSON equality: parts and metadata are JSON. By reference first, which hits for every unchanged message. */
function isSameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Whether two rows render identically — drives reference reuse so the lib's reference-equality memo can skip unchanged
 *  messages. */
function isSameMessage(a: ChatMessage, b: ChatMessage): boolean {
  return a.role === b.role && isSameJson(a.parts, b.parts) && isSameJson(a.metadata, b.metadata);
}

/**
 * A row with its author's avatar as a full URL. It is stored as a relative `imageUrl` (GraphQL owner image or the
 * optimistic auth-store avatar); resolved once here so both the standalone page and the embeddable chat get an absolute
 * src.
 */
function withFullAvatar(message: ChatMessage): ChatMessage {
  const author = message.metadata?.author;
  const avatar = getFullImageUrl(author?.avatar);
  if (!author?.avatar || !avatar || avatar === author.avatar) return message;
  return { ...message, metadata: { ...message.metadata, author: { ...author, avatar } } };
}

export function useMingoDialogChat(dialogId: string | null): UseMingoDialogChat {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore(selectUser);

  const {
    messagesByDialog,
    pushOptimisticSend,
    phaseByDialog,
    setTyping,
    removeWelcomeMessages,
    updateApprovalStatusInMessages,
    isCreatingDialog,
    setCreatingDialog,
  } = useMingoMessagesStore(
    useShallow(s => ({
      messagesByDialog: s.messagesByDialog,
      pushOptimisticSend: s.pushOptimisticSend,
      phaseByDialog: s.phaseByDialog,
      setTyping: s.setTyping,
      removeWelcomeMessages: s.removeWelcomeMessages,
      updateApprovalStatusInMessages: s.updateApprovalStatusInMessages,
      isCreatingDialog: s.isCreatingDialog,
      setCreatingDialog: s.setCreatingDialog,
    })),
  );

  const isTyping = useMemo(() => {
    if (!dialogId) return false;
    return (phaseByDialog.get(dialogId) ?? 'idle') !== 'idle';
  }, [dialogId, phaseByDialog]);

  const createDialogMutation = useCreateDialogMutation();
  const sendMessageMutation = useSendMessageMutation();
  const stopGenerationMutation = useStopGenerationMutation();

  // Previous render's messages, keyed by id, for reference reuse.
  const stableMessagesRef = useRef<Map<string, ChatMessage>>(new Map());

  const messages = useMemo((): ChatMessage[] => {
    if (!dialogId) {
      stableMessagesRef.current = new Map();
      return [];
    }

    const currentMessages = messagesByDialog.get(dialogId) || [];
    // Which approval cards render in the flow, which are lifted into the sticky
    // footer, and how duplicates are deduped is `@/lib/chat-history` — shared
    // with tickets, which consumes the same stream and must sort cards the same
    // way.
    const processed = stripPendingApprovals(currentMessages).map(withFullAvatar);

    // Reference reconciliation: the lib memoizes each rendered message and
    // compares `parts` BY REFERENCE, so it only skips re-rendering when the
    // exact same instance is passed again. The steps above can build fresh
    // objects on every realtime chunk (a filtered bubble, a resolved avatar),
    // defeating that memo and forcing the whole list (and every open menu/card
    // inside it) to re-render. Reuse the previous render's object for any
    // message whose output is structurally unchanged — comparing the FINAL
    // result (not the source) so the cross-message approval dedup above stays
    // correct.
    const prevStable = stableMessagesRef.current;
    const nextStable = new Map<string, ChatMessage>();
    const reconciled = processed.map(msg => {
      const previous = prevStable.get(msg.id);
      const stable = previous && isSameMessage(previous, msg) ? previous : msg;
      nextStable.set(msg.id, stable);
      return stable;
    });
    stableMessagesRef.current = nextStable;

    return reconciled;
  }, [dialogId, messagesByDialog]);

  // The exact complement of `stripPendingApprovals` above — same module, so a
  // card can never be dropped from the flow AND skipped by the footer (which is
  // how a guide card managed to render nowhere at all).
  const approvals = useMemo(() => {
    if (!dialogId) return [];
    return extractPendingApprovals(messagesByDialog.get(dialogId) || []);
  }, [dialogId, messagesByDialog]);

  const isCompacting = useMemo(
    () => (dialogId ? isCompactingTail(messagesByDialog.get(dialogId)) : false),
    [dialogId, messagesByDialog],
  );

  const createDialog = useCallback(
    async ({ title, ...options }: CreateMingoDialogOptions & { title?: string } = {}): Promise<string | null> => {
      if (isCreatingDialog) return null;

      try {
        setCreatingDialog(true);

        const newDialogId = await createDialogMutation.mutateAsync(options);
        // Listed at once (a list read still in flight would drop it again, so
        // it is cancelled first); the refetch then brings the server's row.
        // A named dialog is refetched by its rename instead: before that lands
        // the server's row is untitled, and would list it as "New Chat".
        await queryClient.cancelQueries({ queryKey: mingoDialogQueryKeys.lists });
        insertNewDialog(queryClient, newDialogId, user, { title });
        if (!title) queryClient.invalidateQueries({ queryKey: ['mingo-dialogs'] });

        return newDialogId;
      } catch (error) {
        console.error('[MingoChat] Failed to create dialog:', error);
        // Surface the failure: callers (quick actions, launcher, draft send) only
        // get a null id back and otherwise bail silently, so without this a dialog
        // that can't be created leaves the user with no feedback.
        toast({
          title: 'Failed to start conversation',
          description: error instanceof Error ? error.message : 'Could not create a new chat',
          variant: 'destructive',
          duration: 5000,
        });
        return null;
      } finally {
        setCreatingDialog(false);
      }
    },
    [isCreatingDialog, setCreatingDialog, createDialogMutation, queryClient, user, toast],
  );

  const sendMessage = useCallback(
    async (content: string, targetDialogId?: string, context?: MingoSendContext): Promise<boolean> => {
      const effectiveDialogId = targetDialogId || dialogId;
      if (!effectiveDialogId || !content.trim()) return false;
      if (isTyping) {
        // User-typed sends never reach this guard (the composer is disabled
        // while busy) — this catches programmatic senders (launcher prompts,
        // quick actions) that would otherwise vanish with zero feedback.
        toast({
          title: 'Mingo is busy',
          description: 'Wait for the current operation to finish, then try again',
          duration: 4000,
        });
        return false;
      }

      try {
        setTyping(effectiveDialogId, true);
        removeWelcomeMessages(effectiveDialogId);

        const text = content.trim();
        // TODO(CU-17tkuw635xx): `sent` is `text` once every backend reads record links, and its bubble with it.
        const sent = await textForMingoBackend(effectiveDialogId, text);

        // Sending while an approval pends is an interrupt — backend will
        // cancel it and emit APPROVAL_RESULT (rejected) shortly. Flip the
        // latest pending one now so the card resolves in the same frame as
        // the user-message bubble (no layout jump between the two updates).
        const pendingId = findLatestPendingApprovalId(messagesByDialog.get(effectiveDialogId) || []);
        if (pendingId) {
          updateApprovalStatusInMessages(effectiveDialogId, pendingId, 'rejected');
        }

        const optimisticMessage: ChatMessage = {
          id: makeChatRowId('optimistic'),
          role: 'user',
          metadata: {
            createdAt: new Date().toISOString(),
            author: {
              authorType: 'admin',
              name: adminDisplayName(user),
              // Relative `imageUrl` with cache-bust hash; resolved to a full URL in the thread above.
              avatar: appendImageHash(user?.image?.imageUrl, user?.image?.hash) ?? null,
            },
            // Attach the picked context so the optimistic bubble renders its chips.
            ...(context?.contextItems?.length ? { contextItems: context.contextItems } : {}),
          },
          parts: [{ type: 'text', text: sent === text ? text : mingoUserText(sent) }],
        };

        // Through the reducer: it records the sent text and consumes the
        // backend's MESSAGE_REQUEST echo itself (see `pushOptimisticSend`).
        pushOptimisticSend(effectiveDialogId, optimisticMessage, sent);
        // The chat now has the latest message: first in the history at once. A list
        // read still in flight would put it back, so it is cancelled first.
        await queryClient.cancelQueries({ queryKey: mingoDialogQueryKeys.lists });
        raiseDialog(queryClient, effectiveDialogId);
        await sendMessageMutation.mutateAsync({
          dialogId: effectiveDialogId,
          content: sent,
          // Strip to the `{ type, id }` wire shape; mutation omits empties.
          // Internal `openView` maps to the API's `currentView` field.
          contextItems: context?.contextItems?.map(i => ({ type: i.type, id: i.id })),
          currentView: context?.openView ?? undefined,
          recentViews: context?.recentViews,
          currentPage: context?.currentPage,
          currentList: context?.currentList,
        });

        return true;
      } catch (error) {
        console.error('[MingoChat] Failed to send message:', error);

        setTyping(effectiveDialogId, false);

        toast({
          title: 'Send Failed',
          description: error instanceof Error ? error.message : 'Failed to send message',
          variant: 'destructive',
          duration: 5000,
        });

        return false;
      }
    },
    [
      dialogId,
      isTyping,
      setTyping,
      removeWelcomeMessages,
      pushOptimisticSend,
      messagesByDialog,
      updateApprovalStatusInMessages,
      sendMessageMutation,
      queryClient,
      toast,
      user,
    ],
  );

  const stopGeneration = useCallback(async () => {
    if (!dialogId) return;

    try {
      await stopGenerationMutation.mutateAsync(dialogId);
      setTyping(dialogId, false);
    } catch (error) {
      console.error('[MingoChat] Failed to stop generation:', error);
      toast({
        title: 'Stop Failed',
        description: error instanceof Error ? error.message : 'Failed to stop generation',
        variant: 'destructive',
        duration: 5000,
      });
    }
  }, [dialogId, stopGenerationMutation, setTyping, toast]);

  return {
    // Messages
    messages,
    isLoading: false,

    // Actions
    createDialog,
    sendMessage,
    stopGeneration,

    // Approval system
    approvals,

    // State
    isCreatingDialog,
    isTyping,
    isCompacting,
    assistantType: 'mingo' as const,
  };
}
