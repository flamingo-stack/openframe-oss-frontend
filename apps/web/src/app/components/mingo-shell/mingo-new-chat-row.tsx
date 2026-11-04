'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NavigationSidebarActionRow } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { closeMobileMenu } from './mobile-menu-store';

/**
 * "New chat" at the head of the sidebar's chats (`MingoSidebarHistorySlot`), over the
 * chat history: Mingo's home, a new, empty chat, as the lib's outline action row. It goes
 * through the dock, which goes home first and resets the chat there: reset here, the chat
 * page still on screen would draw the empty new chat until the navigation lands. In the
 * phone drawer it closes the drawer too (the layout closes it on a navigation, which New
 * chat on home is not).
 */
export function MingoNewChatRow({ minimized }: { minimized: boolean }) {
  return (
    <NavigationSidebarActionRow
      variant="outline"
      icon={<PlusCircleIcon />}
      label="New chat"
      minimized={minimized}
      onClick={() => {
        useMingoLauncherStore.getState().startNewChat();
        closeMobileMenu();
      }}
    />
  );
}
