'use client';

import type { ChatStreamEvent } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { useCallback, useEffect, useRef } from 'react';
import type { ChatModelMetadata } from '@/lib/chat-stream-thread';
import { useChatChunkProcessor } from '@/lib/use-chat-chunk-processor';
import { OWNER_TYPE } from '../constants';
import { bindTicketSide, type ChatSide, mutateTicketSide, useTicketDetailsStore } from '../stores/ticket-details-store';

export type { ChatModelMetadata };

interface UseSideChunkProcessorOptions {
  /** Ticket currently open — half of the incomplete-turn seeding key. */
  ticketId: string;
  userDisplayName?: string;
  isDirectMode?: boolean;
  onMetadata?: (metadata: ChatModelMetadata) => void;
}

/**
 * Drives one chat side (client or admin) of a dialog from NATS chunks.
 *
 * Phase 4: chunks feed the lib master stream reducer directly
 * (`decodeNatsChunk` → `ticketChatDialogStore.apply`). The reducer owns
 * every accumulation rule the ~200-LOC callback glue here used to
 * re-implement, and the dialog store's built-in cross-side projections
 * (approval resolution by requestId, tool-execution merge by execId)
 * replace the app's both-sides fan-out. The residual glue (own-echo
 * suppression, approval-status sync, the incomplete-turn seed) is shared
 * with mingo via `useChatChunkProcessor`, and the model-badge side-channel
 * rides the reducer's own `onMetadata` effect; what remains here is
 * genuinely tickets-only: the direct-mode flag sync and the client-authored
 * `direct-message` intercept.
 */
export function useSideChunkProcessor(
  side: ChatSide,
  { ticketId, userDisplayName, isDirectMode, onMetadata }: UseSideChunkProcessorOptions,
) {
  const messages = useTicketDetailsStore(s => s[side].messages);
  const approvalStatuses = useTicketDetailsStore(s => s.approvalStatuses);
  const addMessage = useTicketDetailsStore(s => s.addMessage);
  const setChatHandlers = useTicketDetailsStore(s => s.setChatHandlers);

  const userDisplayNameRef = useRef(userDisplayName);
  userDisplayNameRef.current = userDisplayName;

  // Direct-mode barrier: engage optimistically from the host-known mode so
  // the reducer drops AI events the moment the technician takes over.
  useEffect(() => {
    mutateTicketSide(side, r => r.setDirectMode(!!isDirectMode));
  }, [side, isDirectMode]);

  // Model badge: the reducer emits the mapped metadata as an effect, so the
  // host only late-binds the sink (merged with the view's approve/reject).
  useEffect(() => {
    setChatHandlers(side, { onMetadata });
  }, [side, onMetadata, setChatHandlers]);

  // Client-authored DIRECT_MESSAGE: the lib reducer renders every direct
  // message as an admin-authored row (its home surface only sees technician
  // takeovers). The tickets client chat also carries the END USER's direct
  // replies — keep them user-authored with the device display name, exactly
  // like the pre-Phase-4 glue.
  const interceptEvent = useCallback(
    (event: ChatStreamEvent): boolean => {
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
        return true;
      }
      return false;
    },
    [side, addMessage],
  );

  return useChatChunkProcessor({
    mirror: bindTicketSide(side),
    messages,
    seedKey: `${ticketId}:${side}`,
    approvalStatuses,
    interceptEvent,
  });
}
