'use client';

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { markTourStepDone, setTourDialog, useTourState } from '@/app/(app)/setup/lib/tour-state';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { MINGO_DIALOG_NOT_FOUND } from '../hooks/use-mingo-dialog-selection';
import { GettingStartedBlock } from './getting-started-block';
import { doneTourStepIds } from './tour-progress';
import { TOUR_DIALOG_TITLE, TOUR_STEPS, type TourAction, type TourStep, tourGreeting } from './tour-steps';

type ChatMessage = UnifiedChatState['messages'][number];

export interface MingoTourInput {
  /** The host-built Mingo state the panel renders from. */
  state: UnifiedChatState;
  /** Create an empty conversation with this title and open it. */
  createNamedDialog: (title: string) => Promise<string | null>;
  /** Why the open conversation could not be fetched, or null. */
  dialogError: string | null;
}

export interface MingoTour {
  /** `state`, with Mingo's greeting at the head of the tour's conversation. */
  state: UnifiedChatState;
  /** The Getting Started block while the tour's conversation is open, else null. */
  aboveComposer: ReactNode;
  /** The list's "What to ask Mingo?": the tour's conversation while the tour is on. */
  onWhatToAsk: (() => void) | undefined;
}

/**
 * The Getting Started tour in the Mingo panel (flag `onboarding-v2`).
 *
 * "Start with Mingo" on the setup wizard starts the tour; the first time the
 * panel then shows, it creates the "Welcome to OpenFrame" conversation, opens
 * it and remembers it. In that conversation Mingo's greeting heads the thread
 * (a local message, re-added on every load) and the Getting Started block sits
 * above the composer. A chip sends its prompt there, opens its section beside
 * the chat and marks its step done: on the server for the steps
 * `UserOnboardingStep` knows, on this device for the rest. "Finish tour"
 * completes the user's onboarding, which takes the block away.
 */
export function useMingoTour({ state, createNamedDialog, dialogError }: MingoTourInput): MingoTour {
  const router = useRouter();
  const tour = useTourState();
  const userId = useAuthStore(s => s.user?.id);
  const firstName = useAuthStore(s => s.user?.firstName);
  const user = useOnboardingStore(s => s.user);
  const { completeUserStepInBackground, completeUserInBackground } = useOnboardingMutations();

  // The tour is on: started from the wizard, and the user's onboarding neither
  // finished nor skipped. The progress record is what "Reset Onboarding" and
  // "Finish tour" both move.
  const active = tour !== null && user !== null && !user.completed && !user.skipped;
  const dialogId = active ? tour.dialogId : null;
  const startedAt = tour?.startedAt;
  const { activeDialogId, sendMessage, selectDialog, hasMoreMessages, messages } = state;

  // The tour's conversation, created once. The record is written only on
  // success, so a failed creation is retried on the next mount, not in a loop.
  const creatingRef = useRef(false);
  useEffect(() => {
    if (!active || dialogId || creatingRef.current) return;
    creatingRef.current = true;
    void createNamedDialog(TOUR_DIALOG_TITLE)
      .then(id => setTourDialog(userId, id))
      .finally(() => {
        creatingRef.current = false;
      });
  }, [active, dialogId, createNamedDialog, userId]);

  // The remembered conversation is gone (deleted, or another workspace's
  // record on a shared browser): forget it, so the next pass creates a new one.
  useEffect(() => {
    if (dialogId && activeDialogId === dialogId && dialogError === MINGO_DIALOG_NOT_FOUND) {
      setTourDialog(userId, null);
    }
  }, [dialogId, activeDialogId, dialogError, userId]);

  const localSteps = tour?.steps;
  const serverSteps = user?.completedSteps;
  const doneStepIds = useMemo(() => doneTourStepIds(localSteps, serverSteps), [localSteps, serverSteps]);

  const handleAction = useCallback(
    (step: TourStep, action: TourAction) => {
      // The block shows in the tour's conversation only, so this lands there.
      void sendMessage(action.prompt);
      router.push(action.href);
      markTourStepDone(userId, step.id);
      if (step.userStep !== null && !(serverSteps?.includes(step.userStep) ?? false)) {
        completeUserStepInBackground(step.userStep);
      }
    },
    [sendMessage, router, userId, serverSteps, completeUserStepInBackground],
  );

  const handleFinish = useCallback(() => completeUserInBackground(), [completeUserInBackground]);

  const showing = dialogId !== null && activeDialogId === dialogId;

  // The greeting heads the thread once all of it is loaded: with older pages
  // still to come it would land mid-conversation.
  const greeting = useMemo<ChatMessage | null>(() => {
    if (!showing || hasMoreMessages || !startedAt) return null;
    return {
      id: `tour-greeting-${dialogId}`,
      role: 'assistant',
      content: tourGreeting(firstName),
      timestamp: startedAt,
    };
  }, [showing, hasMoreMessages, startedAt, dialogId, firstName]);

  const decoratedState = useMemo<UnifiedChatState>(
    () => (greeting ? { ...state, messages: [greeting, ...messages] } : state),
    [state, greeting, messages],
  );

  const onWhatToAsk = useMemo(() => (dialogId ? () => selectDialog(dialogId) : undefined), [dialogId, selectDialog]);

  return {
    state: decoratedState,
    aboveComposer: showing ? (
      <GettingStartedBlock
        steps={TOUR_STEPS}
        doneStepIds={doneStepIds}
        onAction={handleAction}
        onFinish={handleFinish}
      />
    ) : null,
    onWhatToAsk,
  };
}
