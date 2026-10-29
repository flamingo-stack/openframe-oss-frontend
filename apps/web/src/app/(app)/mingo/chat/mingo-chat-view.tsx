'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ChatMessageList, type ChatMessageListProps } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  ChatExclamationIcon,
  ChatXmarkIcon,
  Refresh01RightIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, NoData } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useLayoutEffect, useState } from 'react';
import { useChatPageNodeStore } from '@/app/components/mingo-shell/chat-page-node-store';
import { dockViewOf } from '@/app/components/mingo-shell/mingo-dock-route';
import { routes } from '@/lib/routes';
import { useMingoChatSurface, useMingoChatThreadOnScreen } from '../providers/mingo-chat-provider';
import { mingoDialogQueryKeys } from '../utils/query-keys';
import { useChatPageSelection } from './use-chat-page-selection';

/**
 * One conversation as a page of the Mingo-first shell. The page draws no chat of its
 * own: the session's one `EmbeddableChat` lives in the composer dock and portals its
 * header and thread into the node this page publishes (`useChatPageNodeStore`), so
 * the composer and its draft survive every navigation. The page selects its `?id` in
 * the session (`useChatPageSelection`), says the thread is on screen while it shows
 * it (popups and auto-read for that chat), and owns the states the chat cannot show
 * itself: a dialog that does not exist, one that failed to load, a crashed session.
 * An archived chat opens read-only — the chat does that from the dialog's record.
 * `null`: a chat not created yet ("What to ask Mingo?"), the page of the one it creates next.
 */
export function MingoChatView({ dialogId }: { dialogId: string | null }) {
  // A surface: the page shows the chat, so the session runs while it is up even
  // before the dock registers.
  const { chat, error, retry: restartChat } = useMingoChatSurface();
  const status = useChatPageSelection(dialogId, error ? null : chat);
  const queryClient = useQueryClient();

  if (error) {
    return (
      <ChatPageState
        icon={<ChatExclamationIcon />}
        title="Mingo is unavailable right now"
        description="Something went wrong in the chat."
        action={
          <Button variant="outline" leftIcon={<Refresh01RightIcon />} onClick={restartChat}>
            Try again
          </Button>
        }
      />
    );
  }

  if (status === 'not-found') {
    return (
      <ChatPageState
        icon={<ChatXmarkIcon />}
        title="Conversation not available"
        description="It may have been deleted, or you may not have access to it."
        action={
          <Button variant="outline" href={routes.mingo.home}>
            Back to Mingo
          </Button>
        }
      />
    );
  }

  if (status === 'failed' && dialogId !== null) {
    const retry = () => {
      void queryClient.refetchQueries({ queryKey: mingoDialogQueryKeys.detail(dialogId) });
      void queryClient.refetchQueries({ queryKey: mingoDialogQueryKeys.messages(dialogId) });
    };
    return (
      <ChatPageState
        icon={<ChatExclamationIcon />}
        title="Couldn't open this conversation"
        description="Check your connection and try again."
        action={
          <div className="flex flex-wrap justify-center gap-[var(--spacing-system-xsf)]">
            <Button variant="outline" leftIcon={<Refresh01RightIcon />} onClick={retry}>
              Try again
            </Button>
            <Button variant="transparent" href={routes.mingo.home}>
              Back to Mingo
            </Button>
          </div>
        }
      />
    );
  }

  // `isMessagesLoading` covers the dialog's record as well as its messages.
  return <ChatThreadSlot loaded={status === 'ready' && !chat?.state.isMessagesLoading} />;
}

/**
 * The node the docked chat portals its header and thread into. A flex column with a
 * real height (the thread scrolls inside it) and nothing clipping above it: the
 * thread's own menus and modals open inside it. The ref callback publishes the node
 * on mount and `null` on unmount, which hands the dock back its composer-only form.
 *
 * The slot draws the chat's skeleton until the dock's chat has mounted (it loads
 * lazily: a cold start on a chat link) AND the conversation has `loaded`, and only
 * then lets the chat portal in (`threadReady`). Let in on mount, the chat drew its
 * own skeleton over this one, then the messages under "New Chat" until the record
 * landed. Once shown the thread stays: a chat picked from here loads in place.
 */
function ChatThreadSlot({ loaded }: { loaded: boolean }) {
  useMingoChatThreadOnScreen();
  const setNode = useChatPageNodeStore(s => s.setNode);
  const chatMounted = useChatPageNodeStore(s => s.chatMounted);
  const setThreadReady = useChatPageNodeStore(s => s.setThreadReady);
  const [shown, setShown] = useState(false);
  if (!shown && chatMounted && loaded) setShown(true);
  // A layout effect: the thread portals in within the commit the skeleton leaves, one paint.
  useLayoutEffect(() => {
    setThreadReady(shown);
    return () => setThreadReady(false);
  }, [shown, setThreadReady]);
  return (
    <div ref={setNode} data-testid="mingo-chat-thread-slot" className="flex h-full min-h-0 flex-1 flex-col">
      {/* loading-standard-ok(PAGE_CODE): the lib's MingoChatHeader has no loading form; this holds its geometry */}
      {(!chatMounted || !shown) && <ChatThreadSkeleton />}
    </div>
  );
}

const NO_MESSAGES: ChatMessageListProps['messages'] = [];

/**
 * The portalled chat's header and thread, loading: the 56px header row (title, then the
 * ⋯ cell) and the lib's message list in its loading form, in the thread's padding and
 * column (the composer's width, which the dock gives the thread here) — the chat's own
 * geometry, so nothing moves when it lands.
 */
// loading-standard-ok(PAGE_CODE): the header row's bars until the lib's MingoChatHeader draws its own loading form
function ChatThreadSkeleton() {
  return (
    <LoadingRegion label="Loading the conversation" className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="flex h-14 w-full shrink-0 border-b border-ods-border">
        <div className="flex min-w-0 flex-1 items-center px-[var(--spacing-system-m)]">
          {/* loading-standard-ok(PAGE_CODE): the chat title's bar (MingoChatHeader has no loading form) */}
          <UnifiedSkeleton className="h-5 w-48 max-w-full" />
        </div>
        <div className="flex size-14 shrink-0 items-center justify-center border-l border-ods-border">
          {/* loading-standard-ok(PAGE_CODE): the ⋯ cell's glyph (MingoChatHeader has no loading form) */}
          <UnifiedSkeleton className="size-6" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-[var(--spacing-system-m)]">
        <ChatMessageList
          messages={NO_MESSAGES}
          isLoading
          fullWidth
          className={cn('mx-auto w-full flex-1', dockViewOf('chat').widthClassName)}
        />
      </div>
    </LoadingRegion>
  );
}

function ChatPageState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center">
      <NoData icon={icon} title={title} description={description} button={action} />
    </div>
  );
}
