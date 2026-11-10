import { processHistoricalMessagesWithErrors } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it, vi } from 'vitest';
import { CHAT_TYPE, MESSAGE_TYPE, OWNER_TYPE } from '../../tickets/constants';
import { toHistoryOwner } from './history-owner';

vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://acme.example' } }));

const AVATAR = 'https://acme.example/api/images/user/u-1?v=h1';

const admin = {
  type: OWNER_TYPE.ADMIN,
  user: { id: 'u-1', firstName: 'Ann', lastName: 'Lee', image: { imageUrl: '/images/user/u-1', hash: 'h1' } },
};

describe('toHistoryOwner', () => {
  it("resolves the author's image to its absolute gateway URL, hash appended once", () => {
    expect(toHistoryOwner(admin)?.user?.image?.imageUrl).toBe(AVATAR);
  });

  it('keeps the rest of the owner', () => {
    expect(toHistoryOwner(admin)).toMatchObject({
      type: OWNER_TYPE.ADMIN,
      user: { id: 'u-1', firstName: 'Ann', lastName: 'Lee' },
    });
  });

  it('leaves an owner with no image as it is', () => {
    const assistant = { type: OWNER_TYPE.ASSISTANT, model: 'm' };
    const imageless = { type: OWNER_TYPE.ADMIN, user: { id: 'u-2', image: null } };
    expect(toHistoryOwner(assistant)).toBe(assistant);
    expect(toHistoryOwner(imageless)).toBe(imageless);
  });

  it("is what the lib draws as the user bubble's avatar", () => {
    const { messages } = processHistoricalMessagesWithErrors(
      [
        {
          id: 'm-1',
          dialogId: 'd-1',
          chatType: CHAT_TYPE.ADMIN,
          createdAt: '2026-11-01T09:00:00Z',
          owner: toHistoryOwner(admin),
          messageData: [{ type: MESSAGE_TYPE.TEXT, text: 'hello' }],
        },
      ],
      { assistantName: 'Mingo', assistantType: 'mingo', chatTypeFilter: CHAT_TYPE.ADMIN },
    );
    expect(messages.find(m => m.role === 'user')?.avatar).toBe(AVATAR);
  });
});
