'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { fetchQuery, useRelayEnvironment } from 'react-relay';
import type { insightChatPromptRelayQuery as InsightChatPromptQueryType } from '@/__generated__/insightChatPromptRelayQuery.graphql';
import { insightChatPromptRelayQuery } from '@/graphql/insights/insight-chat-prompt-relay';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { useMingoLauncherStore } from '../../mingo/stores/mingo-launcher-store';
import { incidentMingoDraft } from '../utils/fix-with-mingo-draft';
import type { IncidentRow } from '../utils/incident-transform';

/**
 * "Fix with Mingo": fetch the server's prompt for the incident and open the
 * drawer on a fresh chat with it prefilled — nothing sent. `pendingId` is the
 * incident whose prompt is in flight, for the button that started it.
 */
export function useFixWithMingo() {
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const canOpenMingo = useMingoLauncherStore(state => state.canOpen);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fixWithMingo = (incident: IncidentRow) => {
    if (pendingId !== null) return;
    setPendingId(incident.id);
    fetchQuery<InsightChatPromptQueryType>(
      environment,
      insightChatPromptRelayQuery,
      { id: incident.id },
      { fetchPolicy: 'network-only' },
    )
      .toPromise()
      .then(data => {
        if (!data) return;
        useMingoLauncherStore.getState().draftToMingo(incidentMingoDraft(data.insightChatPrompt, incident));
      })
      .catch((error: unknown) => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to prepare the Mingo chat'),
          variant: 'destructive',
        });
      })
      .finally(() => setPendingId(null));
  };

  return { fixWithMingo, pendingId, canOpenMingo };
}
