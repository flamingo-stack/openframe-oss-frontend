'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRef, useState } from 'react';
import { fetchQuery, useRelayEnvironment } from 'react-relay';
import type { insightChatPromptRelayQuery as InsightChatPromptQueryType } from '@/__generated__/insightChatPromptRelayQuery.graphql';
import { openMingoDialogInDrawer } from '@/app/components/notifications/open-mingo-dialog';
import { insightChatPromptRelayQuery } from '@/graphql/insights/insight-chat-prompt-relay';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { useMingoLauncherStore } from '../../mingo/stores/mingo-launcher-store';
import type { DialogNode } from '../../mingo/types';
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
  // The state is for the buttons; the ref is the guard — two clicks in one
  // frame read the same stale state.
  const inFlightRef = useRef(false);

  const fixWithMingo = (incident: IncidentRow) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
      .finally(() => {
        inFlightRef.current = false;
        setPendingId(null);
      });
  };

  return { fixWithMingo, pendingId, canOpenMingo };
}

/** What the Mingo button does and says — the header and the table row share one decision. */
export interface MingoAction {
  label: 'Fix with Mingo' | 'Open Mingo Session';
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

type MingoControls = ReturnType<typeof useFixWithMingo>;

/**
 * `session`: the chat about the incident, null for none, undefined while the
 * lookup is pending (table rows only — the header suspends on it). Inert until
 * the answer is in and while no drawer is mounted (locked workspace).
 */
export function mingoActionFor(
  incident: IncidentRow,
  session: DialogNode | null | undefined,
  { fixWithMingo, canOpenMingo, pendingId }: MingoControls,
): MingoAction {
  if (session) {
    return {
      label: 'Open Mingo Session',
      onClick: () => openMingoDialogInDrawer(session.id),
      // Also while another row's prompt is in flight: that draft, landing,
      // resets the drawer to a new chat over the conversation just opened.
      disabled: !canOpenMingo || pendingId !== null,
      loading: false,
    };
  }
  return {
    label: 'Fix with Mingo',
    onClick: () => fixWithMingo(incident),
    disabled: !canOpenMingo || session === undefined || pendingId !== null,
    loading: pendingId === incident.id,
  };
}
