'use client';

import type { MessageSegment } from '@flamingo-stack/openframe-frontend-core';
import type { ChatContextItem } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { extractPendingApprovals, findLatestPendingApprovalId, stripPendingApprovals } from '@/lib/chat-history';
import { adminDisplayName, makeChatRowId } from '@/lib/chat-stream-thread';
import { appendImageHash, getFullImageUrl } from '@/lib/image-url';
import { selectUser, useAuthStore } from '@/stores';
import {
  useCreateDialogMutation,
  useSendMessageMutation,
  useStopGenerationMutation,
} from '../services/mingo-api-service';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { CoreMessage } from '../types/message.types';

/** Context attached to an outgoing message: the picker selection plus the
 *  current navigation context (resolved by the caller from the context store).
 *  `openView`/`recentViews` carry the minimal `{ type, id }` wire shape. */
export interface MingoSendContext {
  contextItems?: ChatContextItem[];
  openView?: { type: string; id: string } | null;
  recentViews?: Array<{ type: string; id: string }>;
}

/**
 * A reducer row, ready to render.
 *
 * An INTERSECTION with the lib's own `Message`, never a re-declaration of the
 * fields this hook happens to touch. Everything the reducer and the history
 * decoder stamp on a row is owned by the lib — `hidden`, `streamSeq`,
 * `scrollAnchor`, and (Guide Mode V3) the answer's source/card/video metadata —
 * and a hand-listed shape silently drops whatever it does not name. That has
 * already cost a release once: `hidden` was missing here, so an
 * auto-continuation directive the reader must never see rendered as a bubble.
 *
 * What this adds is only what THIS hook guarantees beyond the lib's optional
 * fields: a resolved display name and a real timestamp.
 */
export type ProcessedMessage = CoreMessage & {
  name: string;
  assistantType?: 'fae' | 'mingo';
  timestamp: Date;
};

interface UseMingoChat {
  // Messages
  messages: ProcessedMessage[];
  isLoading: boolean;

  // Actions
  createDialog: () => Promise<string | null>;
  sendMessage: (content: string, targetDialogId?: string, context?: MingoSendContext) => Promise<boolean>;
  stopGeneration: () => Promise<void>;

  // Approval system
  approvals: MessageSegment[];

  // State
  isCreatingDialog: boolean;
  isTyping: boolean;
  isCompacting: boolean;
  assistantType: 'mingo';
}

/** Structural equality on the rendered `content`. Arrays (segment lists) are
 *  compared by reference first (cheap, hits for unchanged messages) and only
 *  fall back to a stringify when lengths match — strings compare by value. */
function isContentEqual(a: ProcessedMessage['content'], b: ProcessedMessage['content']): boolean {
  if (a === b) return true;
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;
  if (!aIsArray || !bIsArray) return false; // both strings, already not === above
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Keys compared by a dedicated rule above, and therefore skipped by the
 *  catch-all sweep. */
const STRUCTURALLY_COMPARED_KEYS: ReadonlySet<string> = new Set(['content', 'timestamp']);

/** Whether two processed messages render identically — drives reference reuse
 *  so the lib's reference-equality memo can skip unchanged messages.
 *
 *  The remaining fields are swept generically rather than listed. A list has to
 *  be extended for every field the lib adds to a row, and forgetting to is
 *  invisible: the pair compares equal, the previous object is reused, and the
 *  new field never reaches the screen — which is the same class of bug as the
 *  `hidden` omission this type's doc-comment describes, one step later in the
 *  pipeline. The sweep compares by reference, exactly as the `contextItems`
 *  rule it replaces did (that value is set once on the optimistic send and
 *  never mutated), so a field the reducer rebuilds per chunk costs a re-render
 *  rather than a stale bubble — the safe direction of the two. */
function isSameProcessedMessage(a: ProcessedMessage, b: ProcessedMessage): boolean {
  if (a.timestamp.getTime() !== b.timestamp.getTime()) return false;
  if (!isContentEqual(a.content, b.content)) return false;

  return shallowEqualExcept(a, b, STRUCTURALLY_COMPARED_KEYS);
}

/** Own-key shallow equality, minus the keys the caller compares itself. */
function shallowEqualExcept<T extends object>(a: T, b: T, skip: ReadonlySet<string>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => skip.has(key) || a[key as keyof T] === b[key as keyof T]);
}

export function useMingoChat(dialogId: string | null): UseMingoChat {
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
  } = useMingoMessagesStore();

  const isTyping = useMemo(() => {
    if (!dialogId) return false;
    return (phaseByDialog.get(dialogId) ?? 'idle') !== 'idle';
  }, [dialogId, phaseByDialog]);

  const createDialogMutation = useCreateDialogMutation();
  const sendMessageMutation = useSendMessageMutation();
  const stopGenerationMutation = useStopGenerationMutation();

  // Previous render's processed messages, keyed by id, for reference reuse.
  const stableMessagesRef = useRef<Map<string, ProcessedMessage>>(new Map());

  const messages = useMemo((): ProcessedMessage[] => {
    if (!dialogId) {
      stableMessagesRef.current = new Map();
      return [];
    }

    const currentMessages = messagesByDialog.get(dialogId) || [];
    // Which approval cards render in the flow, which are lifted into the sticky
    // footer, and how duplicates are deduped is `@/lib/chat-history` — shared
    // with tickets, which consumes the same stream and must sort cards the same
    // way. This hook only maps what survives into `ProcessedMessage`.
    const processed: ProcessedMessage[] = [];

    for (const msg of stripPendingApprovals(currentMessages)) {
      // SPREAD FIRST, then override. The row already carries everything the lib
      // stamped on it; this hook only resolves the two fields it owns. Listing
      // the fields to copy instead is what drops the lib's own metadata (see
      // `ProcessedMessage`).
      processed.push({
        ...msg,
        name: msg.name || 'Unknown',
        // `msg.avatar` is a relative `imageUrl` (GraphQL owner image or the
        // optimistic auth-store avatar); resolve to a full URL once here so
        // both the standalone page and the embeddable chat get an absolute src.
        avatar: getFullImageUrl(msg.avatar) ?? null,
        assistantType: msg.assistantType as 'fae' | 'mingo' | undefined,
        timestamp: msg.timestamp || new Date(),
      });
    }

    // Reference reconciliation: the lib memoizes each rendered message and
    // compares `content` BY REFERENCE, so it only skips re-rendering when the
    // exact same instance is passed again. The mapping above builds fresh
    // objects on every realtime chunk, defeating that memo and forcing the
    // whole list (and every open menu/card inside it) to re-render. Reuse the
    // previous render's object for any message whose processed output is
    // structurally unchanged — comparing the FINAL result (not the source) so
    // the cross-message approval dedup above stays correct.
    const prevStable = stableMessagesRef.current;
    const nextStable = new Map<string, ProcessedMessage>();
    const reconciled = processed.map(msg => {
      const previous = prevStable.get(msg.id);
      const stable = previous && isSameProcessedMessage(previous, msg) ? previous : msg;
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

  const isCompacting = useMemo(() => {
    if (!dialogId) return false;
    const lastMsg = messagesByDialog.get(dialogId)?.at(-1);
    if (lastMsg?.role !== 'assistant' || !Array.isArray(lastMsg.content)) return false;
    const tail = lastMsg.content.at(-1);
    return tail?.type === 'context_compaction' && tail.status === 'started';
  }, [dialogId, messagesByDialog]);

  const createDialog = useCallback(async (): Promise<string | null> => {
    if (isCreatingDialog) return null;

    try {
      setCreatingDialog(true);

      const result = await createDialogMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ['mingo-dialogs'] });

      return result.id;
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
  }, [isCreatingDialog, setCreatingDialog, createDialogMutation, queryClient, toast]);

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

        // Sending while an approval pends is an interrupt — backend will
        // cancel it and emit APPROVAL_RESULT (rejected) shortly. Flip the
        // latest pending one now so the card resolves in the same frame as
        // the user-message bubble (no layout jump between the two updates).
        const pendingId = findLatestPendingApprovalId(messagesByDialog.get(effectiveDialogId) || []);
        if (pendingId) {
          updateApprovalStatusInMessages(effectiveDialogId, pendingId, 'rejected');
        }

        const optimisticMessage: CoreMessage = {
          id: makeChatRowId('optimistic'),
          role: 'user',
          authorType: 'admin',
          content: content.trim(),
          name: adminDisplayName(user),
          // Relative `imageUrl` with cache-bust hash; resolved to a full URL in the processed mapping.
          avatar: appendImageHash(user?.image?.imageUrl, user?.image?.hash) ?? null,
          timestamp: new Date(),
          // Attach the picked context so the optimistic bubble renders its chips.
          contextItems: context?.contextItems?.length ? context.contextItems : undefined,
        };

        // Through the reducer: it records the sent text and consumes the
        // backend's MESSAGE_REQUEST echo itself (see `pushOptimisticSend`).
        pushOptimisticSend(effectiveDialogId, optimisticMessage);
        await sendMessageMutation.mutateAsync({
          dialogId: effectiveDialogId,
          content: content.trim(),
          // Strip to the `{ type, id }` wire shape; mutation omits empties.
          // Internal `openView` maps to the API's `currentView` field.
          contextItems: context?.contextItems?.map(i => ({ type: i.type, id: i.id })),
          currentView: context?.openView ?? undefined,
          recentViews: context?.recentViews,
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
