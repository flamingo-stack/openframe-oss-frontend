'use client';

import type { ChatStreamEntry } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { type ChatModelMetadata, useChatChunkProcessor } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useCallback, useEffect, useRef } from 'react';
import { makeChatRowId } from '@/lib/chat-row';
import { featureFlags } from '@/lib/feature-flags';
import { OWNER_TYPE } from '../constants';
import { bindTicketSide, type ChatSide, mutateTicketSide, useTicketDetailsStore } from '../stores/ticket-details-store';

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
 * Chunks feed the lib's thread store through the lib's `useChatChunkProcessor`, and the dialog store's built-in
 * cross-side projections (approval resolution by its id, a tool's run by its call id) replace the app's both-sides
 * fan-out. The model badge rides the reducer's own `onMetadata` effect; what remains here is genuinely tickets-only:
 * the direct-mode flag sync and the client-authored `direct-message` intercept.
 */
export function useSideChunkProcessor(
  side: ChatSide,
  { userDisplayName, isDirectMode, onMetadata }: UseSideChunkProcessorOptions,
) {
  const messages = useTicketDetailsStore(s => s[side].messages);
  const approvalStatuses = useTicketDetailsStore(s => s.approvalStatuses);
  const addMessage = useTicketDetailsStore(s => s.addMessage);
  const setMetadataHandler = useTicketDetailsStore(s => s.setMetadataHandler);

  const userDisplayNameRef = useRef(userDisplayName);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    userDisplayNameRef.current = userDisplayName;
  });

  // Direct-mode barrier: engage optimistically from the host-known mode so
  // the reducer drops AI chunks the moment the technician takes over.
  useEffect(() => {
    mutateTicketSide(side, r => r.setDirectMode(!!isDirectMode));
  }, [side, isDirectMode]);

  // Model badge: the reducer emits the mapped metadata as an effect, so the
  // host only late-binds the sink.
  useEffect(() => {
    setMetadataHandler(side, onMetadata);
  }, [side, onMetadata, setMetadataHandler]);

  // Client-authored DIRECT_MESSAGE: the lib reducer renders every direct
  // message as an admin-authored row (its home surface only sees technician
  // takeovers). The tickets client chat also carries the END USER's direct
  // replies — keep them user-authored with the device display name, exactly
  // like the pre-Phase-4 glue.
  const interceptEntry = useCallback(
    (entry: ChatStreamEntry): boolean => {
      const chunk = entry.chunks.find(decoded => decoded.type === 'data-chat-participant');
      if (
        chunk?.type === 'data-chat-participant' &&
        chunk.data.kind === 'direct-message' &&
        chunk.data.ownerType &&
        chunk.data.ownerType !== OWNER_TYPE.ADMIN
      ) {
        addMessage(side, {
          id: makeChatRowId('direct'),
          role: 'user',
          metadata: {
            createdAt: new Date().toISOString(),
            author: { name: userDisplayNameRef.current ?? chunk.data.displayName, authorType: 'user' },
            ...(typeof entry.seq === 'number' ? { streamSeq: entry.seq } : {}),
          },
          parts: [{ type: 'text', text: chunk.data.text }],
        });
        return true;
      }
      return false;
    },
    [side, addMessage],
  );

  return useChatChunkProcessor({
    thread: bindTicketSide(side),
    messages,
    approvalStatuses,
    interceptEntry,
    debug: () => featureFlags.debugNatsChunks.enabled(),
  });
}
