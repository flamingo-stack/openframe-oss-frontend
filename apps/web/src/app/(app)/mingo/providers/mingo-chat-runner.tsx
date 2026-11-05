'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Component, type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { registerActiveDialogView } from '@/lib/active-dialog-views';
import { type MingoUnifiedChat, useMingoUnifiedChatState } from '../hooks/use-mingo-unified-chat-state';
import type { MingoChatStore } from './mingo-chat-store';

/**
 * A dialog that won't load is otherwise indistinguishable from an empty one — the
 * panel renders a thread with no messages, which for a conversation reached by link
 * or notification is the whole answer the user gets. Toasted once per
 * (dialog, error) so a retry can't stack duplicates — and once per SESSION, which is
 * why it lives here and not in a surface: two surfaces on screen would toast twice.
 *
 * The reader never sees the underlying error text: the two cases a person can act on
 * differently ("this link is dead" vs "the network is") are already told apart by
 * `dialogNotFound`.
 */
function useDialogErrorToast({
  dialogNotFound,
  state: { activeDialogId, selectDialog, dialogError },
}: MingoUnifiedChat): void {
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

    const missing = dialogNotFound;
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
  }, [dialogError, dialogNotFound, activeDialogId, selectDialog, toast]);
}

/**
 * The one `useMingoUnifiedChatState()` of the session, mounted by `MingoChatProvider`
 * only while a surface is registered — its mount and unmount are the surfaces'. The
 * engine inside it runs the open dialog's live tail.
 */
export function MingoChatRunner({ store, onScreen }: { store: MingoChatStore; onScreen: boolean }) {
  const chat = useMingoUnifiedChatState();

  // A layout effect, so a surface that registered in this same pass renders the
  // state before the browser paints: the store notifies `useSyncExternalStore`,
  // whose re-render is synchronous. The store ignores a result whose fields all
  // match the published one.
  useLayoutEffect(() => {
    store.publish(chat);
  }, [store, chat]);
  useLayoutEffect(() => () => store.reset(), [store]);

  useDialogErrorToast(chat);

  // While the open dialog's thread is on screen the user is watching it, so the
  // notifications pipeline skips its popups and reads them on arrival (see the
  // provider's "Subscribed is not on screen").
  const { activeDialogId } = chat.state;
  useEffect(
    () => (onScreen && activeDialogId ? registerActiveDialogView(activeDialogId) : undefined),
    [activeDialogId, onScreen],
  );

  return null;
}

/**
 * The state runs beside the layout, not inside a surface, so a throw in it would
 * otherwise take the whole shell with it. Caught here and handed to the surfaces
 * (`MingoChatSnapshot.error`), which rethrow into their own boundary — the dock's
 * "Mingo is unavailable". Unmounting with the last surface clears it, so the dock's
 * retry starts a fresh state.
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
