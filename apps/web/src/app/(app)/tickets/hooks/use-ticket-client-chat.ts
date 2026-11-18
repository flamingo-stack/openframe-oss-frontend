'use client';

/**
 * useTicketClientChat: a ticket's client chat (the end user, Fae and the technicians) on the lib's chat engine, the one
 * web chat every app runs. This file is the engine's configuration and nothing else:
 *
 *   transport  the JetStream live tail of the dialog's `message` subject (it replays a gap and drops a redelivery
 *              itself), and the ai-agent's send / approve / reject commands;
 *   history    the dialog's persisted client-chat pages, read with the lib's GraphQL document;
 *   store      `ticketChatStore`, the client side of the dialog's two sides.
 *
 * The engine applies the direct-mode barrier, rejects a pending approval when the technician writes over it, closes the
 * turn on the technician's own direct echo and reads the model badge from the newest answer of the history.
 */

import {
  type ChatTransport,
  createMingoGraphqlHistory,
  jetStreamLiveTail,
  type UnifiedChatState,
  useChatEngine,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo } from 'react';
import {
  type SupportedModelsByProvider,
  getModelLabelByName,
} from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import type { AiModel } from '@/app/hooks/use-ai-model';
import { DISPLAY_APPROVAL_TYPES } from '@/lib/chat-approval-tiers';
import { featureFlags } from '@/lib/feature-flags';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { useAuthStore } from '@/stores';
import { postMingoGraphql } from '../../mingo/hooks/use-mingo-unified-chat-state';
import { ASSISTANT_CONFIG, CHAT_TYPE, NATS_TOPICS, OWNER_TYPE } from '../constants';
import { ticketService } from '../services';
import { ticketChatStore } from '../stores/ticket-chat-store';

/** One page of the client chat's persisted messages, oldest first. */
const fetchClientChatHistory = createMingoGraphqlHistory(postMingoGraphql, { chatType: CHAT_TYPE.CLIENT });

/** The technician's own direct message comes back as theirs: an ADMIN row that names them, or no one. */
const ownUserId = () => useAuthStore.getState().user?.id;

interface UseTicketClientChatOptions {
  /** The ticket's dialog, or null while it has none. */
  dialogId: string | null;
  /** The ticket is in direct mode as far as this page knows (a technician took it over). */
  isDirectMode: boolean;
  /** The assistant's name, as the end user's Fae client shows it. */
  assistantName: string;
  /** The model the NEXT reply would use: the customer's effective AI configuration. */
  baselineModel: AiModel | null;
  modelsByProvider: SupportedModelsByProvider | undefined;
  /** An approval was answered: the ticket's status lock and transitions moved. */
  onApprovalAnswered: () => void;
}

export function useTicketClientChat({
  dialogId,
  isDirectMode,
  assistantName,
  baselineModel,
  modelsByProvider,
  onApprovalAnswered,
}: UseTicketClientChatOptions): UnifiedChatState {
  const { toast } = useToast();
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();

  const transport = useMemo<ChatTransport>(
    () => ({
      replays: true,
      useLiveTail: jetStreamLiveTail({ getNatsWsUrl: getWsUrl, topic: NATS_TOPICS.MESSAGE, onBeforeReconnect }),
      publish: async (text, options) => {
        if (!options.dialogId) return false;
        await ticketService.sendMessage(options.dialogId, text.trim(), CHAT_TYPE.CLIENT);
        return true;
      },
      approve: async requestId => {
        await ticketService.resolveApprovalRequest(requestId, true);
        onApprovalAnswered();
      },
      reject: async requestId => {
        await ticketService.resolveApprovalRequest(requestId, false);
        onApprovalAnswered();
      },
    }),
    [getWsUrl, onBeforeReconnect, onApprovalAnswered],
  );

  const historyModelLabel = useCallback(
    (_provider: string, model: string) => getModelLabelByName(modelsByProvider, model),
    [modelsByProvider],
  );

  return useChatEngine(
    {
      transport,
      history: { fetchDialogMessages: fetchClientChatHistory },
      store: ticketChatStore,
      side: 'client',
      dialogId,
      chatTypeFilter: CHAT_TYPE.CLIENT,
      assistantName,
      assistantType: ASSISTANT_CONFIG.FAE.type,
      displayApprovalTypes: DISPLAY_APPROVAL_TYPES,
      directMode: isDirectMode,
      directMessages: { ownDirectOwnerType: OWNER_TYPE.ADMIN, ownUserId },
      sendSupersedesPending: true,
      historyModelLabel,
      modelProvider: baselineModel?.provider ?? null,
      modelLabel: baselineModel?.displayName ?? null,
      onActionError: (action, error) =>
        toast({
          title: action === 'approve' ? 'Approval Failed' : 'Rejection Failed',
          description: error instanceof Error ? error.message : 'Unable to resolve request',
          variant: 'destructive',
          duration: 5000,
        }),
      debug: () => featureFlags.debugNatsChunks.enabled(),
    },
    { active: !!dialogId },
  );
}
