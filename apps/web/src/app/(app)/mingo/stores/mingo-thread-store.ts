import {
  chatThreadReducerOptions,
  createChatThreadStore,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useAuthStore } from '@/stores';

/**
 * Mingo's threads, one per dialog, in the lib's thread store: module-level, so they outlive the chat surfaces, and a
 * chat reopened mid-turn shows the turn. The lib's chat engine (`useChatEngine`) reads and writes them; this host names
 * only the reducer options. The operator IS the admin: their own send comes back as 'ADMIN'.
 */
export const mingoThreadStore = createChatThreadStore<string>({
  options: chatThreadReducerOptions<string>({
    ownEchoIncludesAdmin: true,
    selfUserId: () => useAuthStore.getState().user?.id,
  }),
});

/** The highest stream sequence the session's copy of a dialog holds, 0 for none. */
export function mingoThreadStreamSeq(dialogId: string): number {
  let max = 0;
  for (const message of mingoThreadStore.snapshotOf(dialogId).messages) {
    const seq = message.metadata?.streamSeq;
    if (typeof seq === 'number' && seq > max) max = seq;
  }
  return max;
}
