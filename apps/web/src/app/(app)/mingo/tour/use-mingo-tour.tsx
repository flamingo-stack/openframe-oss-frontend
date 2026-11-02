'use client';

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRelayEnvironment } from 'react-relay';
import { fetchFirstDevice } from '@/app/(app)/setup/hooks/use-first-device-enrollment';
import { useTourState } from '@/app/(app)/setup/lib/tour-state';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { canOpenFaeApp, openFaeApp } from '@/lib/fae-app';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { MINGO_DIALOG_NOT_FOUND } from '../hooks/use-mingo-dialog-selection';
import { GettingStartedBlock } from './getting-started-block';
import { clearGettingStartedView } from './getting-started-view';
import { doneTourStepIds } from './tour-progress';
import { TOUR_DIALOG_TITLE, type TourAction, type TourStep, tourGreeting, tourPrompt, tourSteps } from './tour-steps';

type ChatMessage = UnifiedChatState['messages'][number];

export interface MingoTourInput {
  /** The host-built Mingo state the panel renders from. */
  state: UnifiedChatState;
  /** Create an empty conversation with this title and open it. */
  createNamedDialog: (title: string) => Promise<string | null>;
  /** Why the open conversation could not be fetched, or null. */
  dialogError: string | null;
  /** A chip opened its section (`href`) and its prompt is on its way: where the host shows the answer. */
  onStepOpened?: (href: string) => void;
}

export interface MingoTour {
  /** `state`, with Mingo's greeting at the head of the tour's conversation. */
  state: UnifiedChatState;
  /** The Getting Started block while the tour's conversation is open, else null. */
  aboveComposer: ReactNode;
}

/**
 * The Getting Started tour in Mingo (flag `onboarding-v2`), run by the
 * Mingo-first shell's composer dock.
 *
 * "Start with Mingo" on the setup wizard starts the tour; the first time the
 * dock then mounts, it creates the "Welcome to OpenFrame" conversation, opens
 * it and records it on the server (`userOnboardingProgress.tourDialogId`), so
 * every device of this user finds the same conversation. In it Mingo's
 * greeting heads the thread (a local message, re-added on every load, and kept
 * once the tour is over) and the Getting Started block sits above the composer,
 * on every page while that conversation is the open one. A chip sends its
 * prompt there through the state it was given, opens its section beside the
 * chat and marks its step done on the server. "Finish tour" completes the
 * user's onboarding, which takes the block
 * away.
 */
export function useMingoTour({ state, createNamedDialog, dialogError, onStepOpened }: MingoTourInput): MingoTour {
  const router = useRouter();
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const handoff = useTourState();
  const firstName = useAuthStore(s => s.user?.firstName);
  const userId = useAuthStore(s => s.user?.id);
  const user = useOnboardingStore(s => s.user);
  const { completeUserStepInBackground, completeUserInBackground, setTourDialogInBackground, skipUserInBackground } =
    useOnboardingMutations();

  // The tour is on while the user's onboarding is neither finished nor skipped
  // (the progress record is what "Reset Onboarding" and "Finish tour" both
  // move) and it has begun: the server knows its conversation, or "Start with
  // Mingo" was just pressed on this device and the conversation is still to
  // be created.
  const inProgress = user !== null && !user.completed && !user.skipped;
  const ended = user !== null && (user.completed || user.skipped);

  // An onboarding finished or skipped elsewhere (another device, another tab):
  // the Getting Started block's remembered shape goes with it here too.
  useEffect(() => {
    if (ended) clearGettingStartedView(userId);
  }, [ended, userId]);
  const recordedDialogId = inProgress ? user.tourDialogId : null;
  const active = inProgress && (recordedDialogId !== null || handoff !== null);
  const { activeDialogId, sendMessage, hasMoreMessages, messages, isLoading } = state;

  // The conversation this panel created, known before the server has recorded
  // it: creating it moves the chat state, which re-runs the effect below while
  // the record is still in flight, and a second conversation would follow.
  const [createdDialogId, setCreatedDialogId] = useState<string | null>(null);
  const candidateDialogId = createdDialogId ?? recordedDialogId;

  // The remembered conversation is gone (deleted, or another workspace's
  // record): treat it as none, so the pass below creates a new one and records
  // that in its place.
  const gone =
    candidateDialogId !== null && activeDialogId === candidateDialogId && dialogError === MINGO_DIALOG_NOT_FOUND;
  const dialogId = gone || !active ? null : candidateDialogId;

  // The tour's conversation, created once and recorded on success; a failed
  // creation is retried on the next mount, not in a loop.
  const creatingRef = useRef(false);
  useEffect(() => {
    if (!active || dialogId || creatingRef.current) return;
    creatingRef.current = true;
    void createNamedDialog(TOUR_DIALOG_TITLE)
      .then(id => {
        if (!id) return;
        setCreatedDialogId(id);
        setTourDialogInBackground(id);
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [active, dialogId, createNamedDialog, setTourDialogInBackground]);

  // The Software module decides one Devices chip; absent until the flags
  // answer, which only swaps that chip's text.
  const softwareManagement = useFeatureFlag('software-management');
  const steps = useMemo(() => tourSteps({ softwareManagement }), [softwareManagement]);

  const serverSteps = user?.completedSteps;
  const doneStepIds = useMemo(() => doneTourStepIds(serverSteps), [serverSteps]);

  const handleAction = useCallback(
    (step: TourStep, action: TourAction): boolean => {
      // While Mingo is answering, the chat refuses a send; the step is not
      // done then, and the block stays where it is. The block disables its
      // chips meanwhile (`busy`), so this only catches a click that lands
      // before that render.
      if (isLoading) {
        toast({
          title: 'Mingo is busy',
          description: 'Wait for the current operation to finish, then try again',
          duration: 4000,
        });
        return false;
      }
      // The block shows in the tour's conversation only, so this lands there.
      // A prompt about the first device names it by its mention; "my device"
      // stands in while there is no device to name (or the read fails). The
      // chip opens its section beside the chat.
      // The step is done once the prompt is in the conversation: a refused
      // or failed send leaves it to try again.
      router.push(action.href);
      onStepOpened?.(action.href);
      void fetchFirstDevice(environment)
        .catch(() => null)
        .then(device => sendMessage(tourPrompt(action, device)))
        .then(sent => {
          if (sent === false) return;
          if (!(serverSteps?.includes(step.userStep) ?? false)) completeUserStepInBackground(step.userStep);
        });
      return true;
    },
    [isLoading, toast, sendMessage, router, serverSteps, completeUserStepInBackground, environment, onStepOpened],
  );

  const handleFinish = useCallback(() => completeUserInBackground(), [completeUserInBackground]);

  const showing = dialogId !== null && activeDialogId === dialogId;

  // The conversation Mingo greeted in keeps the greeting after the tour, finished
  // or skipped: the server keeps it recorded, and the greeting is a local message,
  // so without it a tour that ended before a chip was used - archiving the
  // conversation skips the tour - leaves it empty once it is unarchived.
  const greetedDialogId = createdDialogId ?? user?.tourDialogId ?? null;
  const greeted = greetedDialogId !== null && activeDialogId === greetedDialogId;

  // When the tour began, for the greeting's timestamp: the handoff marker on
  // the device that pressed "Start with Mingo"; elsewhere the first time this
  // panel showed the conversation.
  const [openedAt] = useState(() => new Date().toISOString());
  const startedAt = handoff?.startedAt ?? openedAt;

  // The greeting heads the thread once all of it is loaded: with older pages
  // still to come it would land mid-conversation.
  const greeting = useMemo<ChatMessage | null>(() => {
    if (!greeted || hasMoreMessages) return null;
    return {
      id: `tour-greeting-${greetedDialogId}`,
      role: 'assistant',
      content: tourGreeting(firstName),
      timestamp: startedAt,
    };
  }, [greeted, hasMoreMessages, startedAt, greetedDialogId, firstName]);

  // Archiving the tour's conversation while the tour is on sets the tour
  // aside: it is skipped once the archive lands, so "Reset Onboarding" can
  // bring it back instead of leaving it out of sight and unfinished.
  const { archiveDialog } = state;
  const decoratedState = useMemo<UnifiedChatState>(() => {
    const withGreeting = greeting ? { ...state, messages: [greeting, ...messages] } : state;
    if (!dialogId) return withGreeting;
    return {
      ...withGreeting,
      archiveDialog: async (id: string) => {
        await archiveDialog(id);
        if (id === dialogId) skipUserInBackground();
      },
    };
  }, [state, greeting, messages, dialogId, archiveDialog, skipUserInBackground]);

  return {
    state: decoratedState,
    aboveComposer: showing ? (
      <GettingStartedBlock
        steps={steps}
        doneStepIds={doneStepIds}
        onAction={handleAction}
        onFinish={handleFinish}
        onOpenFae={canOpenFaeApp() ? openFaeApp : undefined}
        busy={isLoading}
      />
    ) : null,
  };
}
