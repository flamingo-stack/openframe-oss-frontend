'use client';

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useRef } from 'react';
import type { DialogIntent } from '@/app/(app)/tickets/constants';
import { routes } from '@/lib/routes';
import type { ComposerRoute } from './mingo-dock-route';

/**
 * Which chat the docked composer writes into, and where the user goes when they send
 * (PLAN §3.7).
 *
 * - **Home is a new chat.** Entering `/mingo`, or closing the sheet there, deselects
 *   the open chat — once, not on every render, so the chat a send from home creates
 *   is not dropped the moment it opens. A draft typed for another chat goes with it:
 *   the composer belongs to the conversation on screen (the lib drops it on every
 *   dialog change). While the sheet is up there its sends continue the chat in it.
 * - **Every other page continues the selected chat.** Nothing to do: the
 *   selection is the session's and outlives navigation.
 * - **A send from any page but the chat page opens the chat over it** (`openSheet`,
 *   the conversation sheet), home included: the page stays where it is, under the
 *   reply, and the sheet's "Open as full chat" takes it to its page. A send into the open chat
 *   opens it at once (its id is known); a send that creates a chat opens it as soon
 *   as the id commits — any dock send with no chat open, launcher prompts and intent
 *   chats (`sendInNewDialog`, `createIntentDialog`).
 * - **A chat that becomes active on home without a send, and not in the sheet, goes to
 *   its page**, `routes.mingo.chat(id)`: the Getting Started tour's, which it creates itself.
 * - **Sends on the chat page stay put.** A chat created there is the page's to
 *   follow (`use-chat-page-selection.ts`).
 * - **A phone opens the chat on its page** wherever the sheet would rise: there a chat
 *   takes the screen, and only its page is the full chat.
 *
 * The panel's own sends reach this through `EmbeddableChat.onMessageSent` (`onMessageSent` below), as they go out:
 * the dialog they go into, or none when they create one. `onDialogCreated` is not used: the host-side sends (home
 * chips, launcher prompts) need this selection-based follow anyway, and two mechanisms would navigate twice for one
 * send.
 */
interface ComposerTargetOptions {
  route: ComposerRoute;
  state: UnifiedChatState;
  /** A new chat sent `text` at once (`UnifiedChatState.startNewDialog({ prompt })`). */
  sendInNewDialog: (text: string) => Promise<string | null>;
  /** A new chat created to make one entity (`UnifiedChatState.startNewDialog({ intent })`). */
  createIntentDialog: (intent: DialogIntent) => Promise<string | null>;
  navigate: (href: string) => void;
  /** Raise the chat over the page (`useMingoSheetStore.show`). */
  openSheet: () => void;
  /** The sheet is up on this route (`isSheetUp` and `canShowSheet`). */
  sheetOpen: boolean;
  /** A phone: the chat opens on its page instead of in the sheet. */
  phone?: boolean;
}

interface ComposerTarget {
  /** A send from the panel went out (`EmbeddableChat.onMessageSent`): the chat it goes into, or null for a new one. */
  onMessageSent: (send: { dialogId: string | null }) => void;
  /** `sendInNewDialog` that follows the chat it creates. */
  sendInNewDialog: (text: string) => Promise<string | null>;
  /** `createIntentDialog` that follows the chat it creates. */
  createIntentDialog: (intent: DialogIntent) => Promise<string | null>;
}

/** Shows a chat a send went to: over the page, or on a phone on the chat's own page. */
function openChat(
  dialogId: string,
  { phone, navigate, openSheet }: Pick<ComposerTargetOptions, 'phone' | 'navigate' | 'openSheet'>,
): void {
  if (phone) navigate(routes.mingo.chat(dialogId));
  else openSheet();
}

/**
 * A send that will create a chat; `from` is the chat open when it started. A panel send (`settlesWithCreate`) is told
 * only that it went out, so it ends when the engine's create does (`isDialogsLoading` rises and falls): `creating` is
 * set once it has risen.
 */
interface PendingFollow {
  from: string | null;
  settlesWithCreate?: boolean;
  creating?: boolean;
}

export function useComposerTarget({
  route,
  state,
  sendInNewDialog,
  createIntentDialog,
  navigate,
  openSheet,
  sheetOpen,
  phone = false,
}: ComposerTargetOptions): ComposerTarget {
  const activeDialogId = state.activeDialogId ?? null;
  const { selectDialog, isDialogsLoading } = state;

  // Home: a new chat, once each time it shows with the sheet down — on entering it,
  // and on closing the sheet over it. The chat in the sheet stays open until then.
  const homeVisitRef = useRef(false);
  useEffect(() => {
    if (route !== 'home' || sheetOpen) {
      homeVisitRef.current = false;
      return;
    }
    if (homeVisitRef.current) return;
    homeVisitRef.current = true;
    if (activeDialogId !== null) selectDialog(null);
  }, [route, sheetOpen, activeDialogId, selectDialog]);

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
    if (created) openChat(activeDialogId, { phone, navigate, openSheet });
    else if (route === 'home' && !sheetOpen) navigate(routes.mingo.chat(activeDialogId));
  }, [activeDialogId, route, sheetOpen, phone, navigate, openSheet]);

  // A panel send that created nothing (the create failed) disarms once the engine's create is over, so a later
  // selection is not taken for its chat. One that created it was followed by the effect above, in the same commit.
  useEffect(() => {
    const follow = followRef.current;
    if (!follow?.settlesWithCreate) return;
    if (isDialogsLoading) follow.creating = true;
    else if (follow.creating && committedIdRef.current === follow.from) followRef.current = null;
  }, [isDialogsLoading]);

  // Wraps a send that may create a chat. A send that ends with no new chat (the
  // create failed) disarms, so a later selection is not taken for its chat. One
  // that created it was already followed by the effect above: the id commits before
  // the send itself returns.
  //
  // `catch` + rethrow, not `finally`: the React Compiler cannot lower a `try` without
  // a `catch`, and skipped this whole hook over it.
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

  const onMessageSent = ({ dialogId }: { dialogId: string | null }) => {
    if (dialogId === null) {
      followRef.current = { from: committedIdRef.current, settlesWithCreate: true, creating: isDialogsLoading };
      return;
    }
    // The reply streams into the thread: over the page, or on the chat's own page.
    if (route !== 'chat') openChat(dialogId, { phone, navigate, openSheet });
  };

  return {
    onMessageSent,
    sendInNewDialog: text => following(() => sendInNewDialog(text)),
    createIntentDialog: intent => following(() => createIntentDialog(intent)),
  };
}
