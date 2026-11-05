import {
  chatThreadReducerOptions,
  createChatDialogSidesStore,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useAuthStore } from '@/stores';

/** The two chats of a ticket's dialog: the end user's with Fae (`client`) and the technician's with Mingo (`admin`). */
export type TicketChatSide = 'client' | 'admin';

/**
 * A ticket's chats, as the lib's store of dialogs with sides: one thread per (dialog, side), and an approval answered or
 * a tool run on one side shows on the other. Module-level, so a ticket reopened mid-turn shows the turn. The viewer IS
 * the admin (OpenFrame's operator), so their own send comes back as an ADMIN row and is consumed as their echo; the
 * signed-in id tells it from another technician's identical message.
 */
export const ticketChatStore = createChatDialogSidesStore<TicketChatSide>({
  sides: ['client', 'admin'],
  options: chatThreadReducerOptions<TicketChatSide>({
    ownEchoIncludesAdmin: true,
    selfUserId: () => useAuthStore.getState().user?.id,
  }),
});
