import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { mutateTicketSide, useTicketDetailsStore } from './ticket-details-store';

const row = (id: string, text: string): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });

describe('mutateTicketSide', () => {
  beforeEach(() => {
    useTicketDetailsStore.getState().clearChatState();
  });

  it('runs the commands on one side and mirrors that side into the store', () => {
    mutateTicketSide('admin', reducer => reducer.setMessages([row('m1', 'hello')]));

    const state = useTicketDetailsStore.getState();
    expect(state.admin.messages.map(message => message.id)).toEqual(['m1']);
    expect(state.client.messages).toEqual([]);
  });

  it('returns what the commands return', () => {
    const result = mutateTicketSide('client', reducer => {
      reducer.setMessages([row('m1', 'one'), row('m2', 'two')]);
      return 'done';
    });

    expect(result).toBe('done');
    expect(useTicketDetailsStore.getState().client.messages).toHaveLength(2);
  });
});
