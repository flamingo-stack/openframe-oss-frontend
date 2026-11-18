'use client';

import { usePathname } from 'next/navigation';
import { useNativeBackDismissible } from '@/lib/native-back';
import { MingoPhoneChatList } from './mingo-phone-chat-list';
import { isListUp, useMingoSheetStore } from './mingo-sheet-store';

/**
 * Manhattan v2 on a phone: the chat list (`MingoPhoneChatList`) in a panel from the left, under the top bar
 * (`AppLayout` `mobileStartPanel`, the lib's `MobileSidePanel`: 320px, the whole width under 400px), as the burger
 * menu's navigation comes from the right. The top bar's Mingo button opens and closes it (`listOpen`); the scrim,
 * Escape, a swipe left, Android back and a pick close it too.
 *
 * `enabled` off (no v2, no Mingo): nothing, so `AppLayout` draws no panel.
 */
export function useMingoPhoneChatsPanel(enabled: boolean) {
  const pathname = usePathname();
  const open = useMingoSheetStore(s => isListUp(s, pathname)) && enabled;
  const hideList = useMingoSheetStore(s => s.hideList);
  useNativeBackDismissible(open, hideList);
  if (!enabled) return undefined;
  return {
    open,
    onClose: hideList,
    label: 'Chats',
    // The chats on the sidebars' dark panel ground, scrolling inside the panel.
    content: (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <MingoPhoneChatList />
      </div>
    ),
  };
}
