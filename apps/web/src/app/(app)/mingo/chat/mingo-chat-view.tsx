'use client';

import {
  ChatExclamationIcon,
  ChatXmarkIcon,
  Refresh01RightIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, NoData } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChatPageNodeStore } from '@/app/components/mingo-shell/chat-page-node-store';
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
 */
export function MingoChatView({ dialogId }: { dialogId: string }) {
  // A surface: the page shows the chat, so the session runs while it is up even
  // before the dock registers.
  const { chat, error } = useMingoChatSurface();
  const status = useChatPageSelection(dialogId, error ? null : chat);
  const queryClient = useQueryClient();

  if (error) {
    return (
      <ChatPageState
        icon={<ChatExclamationIcon />}
        title="Mingo is unavailable right now"
        description="Reload the app to try again."
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

  if (status === 'failed') {
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

  return <ChatThreadSlot />;
}

/**
 * The node the docked chat portals its header and thread into. A flex column with a
 * real height (the thread scrolls inside it) and nothing clipping above it: the
 * thread's own menus and modals open inside it. The ref callback publishes the node
 * on mount and `null` on unmount, which hands the dock back its composer-only form.
 */
function ChatThreadSlot() {
  useMingoChatThreadOnScreen();
  const setNode = useChatPageNodeStore(s => s.setNode);
  return <div ref={setNode} data-testid="mingo-chat-thread-slot" className="flex h-full min-h-0 flex-1 flex-col" />;
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
