'use client';

import { decodeNatsChunk } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { useCallback, useEffect, useRef } from 'react';
import { computeIncompleteTailState } from '@/lib/chat-stream-thread';
import { useAuthStore } from '@/stores';
import { OWNER_TYPE } from '../constants';
import {
  applyTicketChatEvent,
  type ChatSide,
  mutateTicketSide,
  syncTicketApprovalStatuses,
  useTicketDetailsStore,
} from '../stores/ticket-details-store';

interface UseSideChunkProcessorOptions {
  userDisplayName?: string;
  isDirectMode?: boolean;
  onMetadata?: (metadata: {
    modelDisplayName: string;
    modelName: string;
    providerName: string;
    contextWindow: number;
  }) => void;
}

/**
 * Drives one chat side (client or admin) of a dialog from NATS chunks.
 *
 * Phase 4: chunks feed the lib master stream reducer directly
 * (`decodeNatsChunk` → `ticketChatDialogStore.apply`). The reducer owns
 * every accumulation rule the ~200-LOC callback glue here used to
 * re-implement, and the dialog store's built-in cross-side projections
 * (approval resolution by requestId, tool-execution merge by execId)
 * replace the app's both-sides fan-out. Remaining side concerns: own-echo
 * suppression, the metadata side-channel for the model badge, the direct-
 * mode flag sync, client-authored direct-message rows (the lib reducer
 * renders every direct message as admin-authored — see the comment
 * below), and the one-shot incomplete-turn seed after history hydration.
 */
export function useSideChunkProcessor(
  side: ChatSide,
  { userDisplayName, isDirectMode, onMetadata }: UseSideChunkProcessorOptions,
) {
  const messages = useTicketDetailsStore(s => s[side].messages);
  const approvalStatuses = useTicketDetailsStore(s => s.approvalStatuses);
  const addMessage = useTicketDetailsStore(s => s.addMessage);

  const currentUserId = useAuthStore(state => state.user?.id);
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const onMetadataRef = useRef(onMetadata);
  onMetadataRef.current = onMetadata;
  const userDisplayNameRef = useRef(userDisplayName);
  userDisplayNameRef.current = userDisplayName;

  // Direct-mode barrier: engage optimistically from the host-known mode so
  // the reducer drops AI events the moment the technician takes over.
  useEffect(() => {
    mutateTicketSide(side, r => r.setDirectMode(!!isDirectMode));
  }, [side, isDirectMode]);

  // Status lookup the reducer consults when an APPROVAL_REQUEST replays.
  useEffect(() => {
    if (Object.keys(approvalStatuses).length > 0) {
      syncTicketApprovalStatuses(side, approvalStatuses);
    }
  }, [side, approvalStatuses]);

  // One-shot incomplete-turn seed: once the hydrated thread shows an
  // unfinished trailing assistant run (pending approvals / executing
  // tools), seed the reducer's per-turn kernel so continuation chunks
  // merge instead of replaying into a fresh bubble.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || messages.length === 0) return;
    const extras = computeIncompleteTailState(messages);
    if (!extras) return;
    seededRef.current = true;
    mutateTicketSide(side, r => r.initializeWithState(null, extras));
  }, [side, messages]);

  const processChunk = useCallback(
    (chunk: unknown) => {
      const event = decodeNatsChunk(chunk);
      if (!event) return;

      // Side-channel: model badge refinement (kept outside the reducer).
      if (event.type === 'metadata') {
        onMetadataRef.current?.({
          modelDisplayName: event.modelLabel ?? event.modelName ?? '',
          modelName: event.modelName ?? '',
          providerName: event.provider ?? '',
          contextWindow: event.contextWindowMaxTokens ?? 0,
        });
      }

      // Own MESSAGE_REQUEST echo — the optimistic admin send already
      // rendered it.
      if (
        event.type === 'participant' &&
        event.kind === 'message-request' &&
        event.userId &&
        event.userId === currentUserIdRef.current
      ) {
        return;
      }

      // Client-authored DIRECT_MESSAGE: the lib reducer renders every
      // direct message as an admin-authored row (its home surface only
      // sees technician takeovers). The tickets client chat also carries
      // the END USER's direct replies — keep them user-authored with the
      // device display name, exactly like the pre-Phase-4 glue.
      if (
        event.type === 'participant' &&
        event.kind === 'direct-message' &&
        event.ownerType &&
        event.ownerType !== OWNER_TYPE.ADMIN
      ) {
        addMessage(side, {
          id: `direct-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: 'user',
          content: event.text,
          name: userDisplayNameRef.current ?? event.displayName,
          authorType: 'user',
          timestamp: new Date(),
          streamSeq: event.seq,
        });
        return;
      }

      applyTicketChatEvent(side, event);
    },
    [side, addMessage],
  );

  return processChunk;
}
