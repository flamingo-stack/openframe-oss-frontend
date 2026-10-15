import { maxPersistedStreamSeq } from '@flamingo-stack/openframe-frontend-core';
import { OWNER_TYPE } from '../../tickets/constants';
import type { MessagePage } from '../types';

/**
 * Where the dialog's JetStream consumer starts, from fresh history pages: the
 * sequence to resume after, or `null` for a live tail.
 *
 * The ai-agent stamps every assistant row with the sequence of the last chunk
 * it persisted (`lastChunkStreamSeq`; the AI-mode user row carries none), so
 * the highest stamp is where history ends on the stream. With no stamp, 0
 * replays everything the stream retains for the dialog — right for a dialog
 * whose first answer is still streaming: history holds only the user's row,
 * and the replay is the one copy of the answer so far.
 *
 * Assistant rows with no stamp at all (persisted by an ai-agent that did not
 * stamp) say nothing about where history ends. Replaying from 0 then re-renders
 * every one of their turns the stream still retains, and the merge cannot
 * drop them: its coverage IS those stamps. Those turns are in history already,
 * so the tail starts live; a turn of such a dialog streaming at that moment
 * loses its head, which is the cost accepted.
 */
export function historyStreamFloor(pages: readonly MessagePage[] | undefined): number | null {
  const floor = maxPersistedStreamSeq(pages);
  if (floor > 0) return floor;
  const hasAssistantRow = pages?.some(page => page.messages.some(m => m.owner.type === OWNER_TYPE.ASSISTANT));
  return hasAssistantRow ? null : 0;
}
