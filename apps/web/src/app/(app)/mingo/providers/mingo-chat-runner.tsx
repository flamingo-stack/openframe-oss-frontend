'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Component, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { MINGO_DIALOG_NOT_FOUND } from '../hooks/use-mingo-dialog-selection';
import { DialogSubscription } from '../hooks/use-mingo-realtime-subscription';
import { useMingoUnifiedChatState } from '../hooks/use-mingo-unified-chat-state';
import { useMingoLauncherStore } from '../stores/mingo-launcher-store';
import type { MingoChatState, MingoChatStore } from './mingo-chat-store';

/**
 * A dialog that won't load is otherwise indistinguishable from an empty one — the
 * panel renders a thread with no messages, which for a conversation reached by link
 * or notification is the whole answer the user gets. Toasted once per
 * (dialog, error) so a retry can't stack duplicates — and once per SESSION, which is
 * why it lives here and not in a surface: two surfaces on screen would toast twice.
 *
 * The reader never sees the underlying error text: it is a raw GraphQL-envelope
 * string, and the two cases a person can act on differently ("this link is dead" vs
 * "the network is") are already separated by `MINGO_DIALOG_NOT_FOUND`.
 */
function useDialogErrorToast({ dialogError, state: { activeDialogId, selectDialog } }: MingoChatState): void {
  const { toast } = useToast();
  const toastedDialogErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dialogError || !activeDialogId) {
      toastedDialogErrorRef.current = null;
      return;
    }
    const key = `${activeDialogId}:${dialogError}`;
    if (toastedDialogErrorRef.current === key) return;
    toastedDialogErrorRef.current = key;

    const missing = dialogError === MINGO_DIALOG_NOT_FOUND;
    toast({
      title: missing ? 'Conversation not available' : "Couldn't open this conversation",
      description: missing
        ? 'It may have been deleted, or you may not have access to it.'
        : 'Check your connection and try again.',
      variant: 'destructive',
    });

    // Only for a settled "not found": drop the selection so the surface falls back
    // to the chat list and the sync hook strips the dead id from the URL, leaving
    // nothing to re-open on reload or to copy onward. A transient failure keeps its
    // selection, because a reload would have recovered it.
    if (missing) selectDialog(null);
  }, [dialogError, activeDialogId, selectDialog, toast]);
}

/**
 * Queued launcher prompt (`sendToMingo(prompt)` — the onboarding "Meet Mingo" chips,
 * the Help Center "Ask Mingo" card): drained straight into a fresh dialog. It needs
 * the chat state and nothing a surface draws, so it runs once per session, here.
 *
 * `sendToMingo` also opens the drawer, which is what registers a surface and starts
 * this, so in the classic shell it still fires on that open — and re-fires when a new
 * prompt is queued while the chat is already up. `consumePendingPrompt` nulls the
 * prompt as it reads it, so an open with no prompt and StrictMode's double-invoke
 * are both no-ops.
 *
 * The other two launcher requests — a draft and "start a new chat" — stay with the
 * surface: they go through the chat panel's imperative handle.
 */
function useLauncherPromptDrain({ sendInNewDialog }: MingoChatState): void {
  const pendingPrompt = useMingoLauncherStore(s => s.pendingPrompt);
  const consumePendingPrompt = useMingoLauncherStore(s => s.consumePendingPrompt);

  useEffect(() => {
    if (!pendingPrompt) return;
    const text = consumePendingPrompt();
    if (!text) return;
    void sendInNewDialog(text);
  }, [pendingPrompt, consumePendingPrompt, sendInNewDialog]);
}

/**
 * The one `useMingoUnifiedChatState()` of the session, mounted by `MingoChatProvider`
 * only while a surface is registered — its mount and unmount are the surfaces', so
 * every request, poll and live tail starts and stops exactly where it did when the
 * state lived inside the drawer.
 */
export function MingoChatRunner({ store, onScreen }: { store: MingoChatStore; onScreen: boolean }) {
  const { subscription, ...chat } = useMingoUnifiedChatState();

  // A layout effect, so a surface that registered in this same pass renders the
  // state before the browser paints: the store notifies `useSyncExternalStore`,
  // whose re-render is synchronous. The store ignores a result whose fields all
  // match the published one.
  useLayoutEffect(() => {
    store.publish(chat);
  }, [store, chat]);
  useLayoutEffect(() => () => store.reset(), [store]);

  useDialogErrorToast(chat);
  useLauncherPromptDrain(chat);

  // Realtime tail for the active dialog — writes chunks into the shared store.
  // Gated on active + subscribed; on a remount it resubscribes and replays missed
  // chunks from the stored sequence offset. `onScreen`: whether the dialog counts
  // as watched (see the provider's "Subscribed is not on screen").
  if (!subscription.activeDialogId || !subscription.isSubscribed) return null;
  return (
    <DialogSubscription
      key={subscription.activeDialogId}
      dialogId={subscription.activeDialogId}
      isActive
      onApprove={subscription.onApprove}
      onReject={subscription.onReject}
      approvalStatuses={subscription.approvalStatuses}
      onConnectionChange={subscription.onConnectionChange}
      onMetadata={subscription.onMetadata}
      initialOptStartSeq={subscription.initialOptStartSeq}
      isInitialOptStartSeqReady={subscription.isInitialOptStartSeqReady}
      onScreen={onScreen}
    />
  );
}

/**
 * The state now runs beside the layout instead of inside a surface, so a throw in it
 * would otherwise take the whole shell with it. Caught here and handed to the
 * surfaces (`MingoChatSnapshot.error`), which rethrow into their own boundary — the
 * same "Mingo is unavailable" panel a crash inside the drawer showed. Unmounting
 * with the last surface clears it, so closing the panel is still the retry.
 */
export class MingoChatRunnerBoundary extends Component<
  { store: MingoChatStore; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[MingoChatProvider] chat state crashed:', error);
    this.props.store.fail(error instanceof Error ? error : new Error(String(error)));
  }

  componentWillUnmount() {
    this.props.store.reset();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
