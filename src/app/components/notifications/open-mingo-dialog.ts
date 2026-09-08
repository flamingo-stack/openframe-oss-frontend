import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';

/**
 * Opens a Mingo dialog in the in-layout chat drawer — the only Mingo surface there
 * is. The drawer reads the module-level Mingo store, so setting the active dialog +
 * opening the launcher is all it needs to render it; `resetUnread` clears the
 * dialog's own badge. Plain function (reads stores via `getState`), so it's callable
 * from event handlers and non-React module code (e.g. a desktop-notification click).
 */
export function openMingoDialogInDrawer(dialogId: string): void {
  const messages = useMingoMessagesStore.getState();
  messages.setActiveDialogId(dialogId);
  messages.resetUnread(dialogId);
  useMingoLauncherStore.getState().setOpen(true);
}
