'use client';

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useRef } from 'react';
import type { DialogIntent } from '@/app/(app)/tickets/constants';
import { routes } from '@/lib/routes';
import { type ComposerRoute, isSheetRoute } from './mingo-dock-route';

/**
 * Which chat the docked composer writes into, and where the user goes when they send
 * (PLAN §3.7).
 *
 * - **Home is a new chat.** Entering `/mingo` deselects the open chat — once per
 *   visit, not on every render, so the chat a send from home creates is not
 *   dropped the moment it opens. A draft typed for another chat goes with it: the
 *   composer belongs to the conversation on screen (the lib drops it on every
 *   dialog change).
 * - **Every other page continues the selected chat.** Nothing to do: the
 *   selection is the session's and outlives navigation.
 * - **A send from a page opens the chat over it** (`openSheet`, the conversation
 *   sheet): the page stays where it is, under the reply. A send into the open chat
 *   opens it at once (its id is known); a send that creates a chat opens it as soon
 *   as the id commits — any dock send with no chat open, launcher prompts and intent
 *   chats (`sendInNewDialog`, `createIntentDialog`).
 * - **A send from home goes to its chat**, `routes.mingo.chat(id)`: home is always a
 *   new chat, so ANY chat that becomes active there was just created, by the dock or
 *   by the home page's own quick actions (`chat.sendInNewDialog`, outside the panel).
 * - **Sends on the chat page stay put.** A chat created there is the page's to
 *   follow (`use-chat-page-selection.ts`).
 *
 * `EmbeddableChat.onDialogCreated` is not used: it reports only the panel's own
 * sends, and the host-side ones (home chips, launcher prompts) need this
 * selection-based follow anyway — two mechanisms would navigate twice for one send.
 */
interface ComposerTargetOptions {
  route: ComposerRoute;
  state: UnifiedChatState;
  /** The session's always-new send (`MingoChatState.sendInNewDialog`). */
  sendInNewDialog: (text: string) => Promise<void>;
  /** A new chat created to make one entity (`MingoChatState.createIntentDialog`). */
  createIntentDialog: (intent: DialogIntent) => Promise<string | null>;
  navigate: (href: string) => void;
  /** Raise the chat over the page (`useMingoSheetStore.show`). */
  openSheet: () => void;
}

interface ComposerTarget {
  /** `state` whose send, when no chat is open, follows the chat it creates. Hand it to `EmbeddableChat`. */
  mingoState: UnifiedChatState;
  /** `sendInNewDialog` that follows the chat it creates. */
  sendInNewDialog: (text: string) => Promise<void>;
  /** `createIntentDialog` that follows the chat it creates. */
  createIntentDialog: (intent: DialogIntent) => Promise<string | null>;
}

/** A send that will create a chat; `from` is the chat open when it started. */
interface PendingFollow {
  from: string | null;
}

export function useComposerTarget({
  route,
  state,
  sendInNewDialog,
  createIntentDialog,
  navigate,
  openSheet,
}: ComposerTargetOptions): ComposerTarget {
  const activeDialogId = state.activeDialogId ?? null;
  const { selectDialog } = state;

  // Home: a new chat, once per visit.
  const homeVisitRef = useRef(false);
  useEffect(() => {
    if (route !== 'home') {
      homeVisitRef.current = false;
      return;
    }
    if (homeVisitRef.current) return;
    homeVisitRef.current = true;
    if (activeDialogId !== null) selectDialog(null);
  }, [route, activeDialogId, selectDialog]);

  // The last active chat this hook has seen committed, and the send waiting for its chat.
  const committedIdRef = useRef(activeDialogId);
  const followRef = useRef<PendingFollow | null>(null);
  useEffect(() => {
    const previous = committedIdRef.current;
    committedIdRef.current = activeDialogId;
    if (activeDialogId === null || activeDialogId === previous) return;
    const follow = followRef.current;
    const created = follow !== null && follow.from !== activeDialogId;
    if (created) followRef.current = null;
    // The chat page follows its selection itself (`use-chat-page-selection.ts`).
    if (route === 'chat') return;
    if (route === 'home') navigate(routes.mingo.chat(activeDialogId));
    else if (created && isSheetRoute(route)) openSheet();
  }, [activeDialogId, route, navigate, openSheet]);

  // Wraps a send that may create a chat. A send that ends with no new chat (the
  // create failed) disarms, so a later selection is not taken for its chat. One
  // that created it was already followed by the effect above: the id commits before
  // the send itself returns.
  //
  // `catch` + rethrow, not `finally`: the React Compiler cannot lower a `try` without
  // a `catch`, and skipped this whole hook over it, so `mingoState` was new on every
  // render of the dock.
  const following = async <T>(send: () => Promise<T>): Promise<T> => {
    const follow: PendingFollow = { from: committedIdRef.current };
    followRef.current = follow;
    const disarm = () => {
      if (followRef.current === follow && committedIdRef.current === follow.from) followRef.current = null;
    };
    try {
      const result = await send();
      disarm();
      return result;
    } catch (error) {
      disarm();
      throw error;
    }
  };

  const mingoState: UnifiedChatState = {
    ...state,
    sendMessage: (text, options) => {
      const open = state.activeDialogId;
      if (!open) return following(() => state.sendMessage(text, options));
      // The reply streams into the thread: over the page, or on the chat's own page.
      if (isSheetRoute(route)) openSheet();
      else if (route !== 'chat') navigate(routes.mingo.chat(open));
      return state.sendMessage(text, options);
    },
  };

  return {
    mingoState,
    sendInNewDialog: text => following(() => sendInNewDialog(text)),
    createIntentDialog: intent => following(() => createIntentDialog(intent)),
  };
}
