import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { describe, expect, it } from 'vitest';
import type { ClientView } from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { ASSISTANT_CONFIG } from '../constants';
import { assistantAuthor, clientChatAssistant, withAssistantAvatar } from './client-chat-assistant';

const view = (overrides: Partial<ClientView>): ClientView => ({
  id: 'v-1',
  organizationId: null,
  assistantName: 'Praesto',
  assistantAvatar: null,
  accentColor: '',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: null,
  ...overrides,
});

const customerView = view({
  organizationId: 'org-1',
  assistantName: 'Praesto',
  assistantAvatar: { imageUrl: '/images/assistant/org-1', hash: 'h1' },
});
const tenantView = view({ assistantName: 'Tenant Bot', assistantAvatar: { imageUrl: '/images/assistant/tenant' } });

describe('clientChatAssistant', () => {
  it("takes the customer's name and avatar, as a full address with its hash", () => {
    const assistant = clientChatAssistant(customerView, tenantView);
    expect(assistant.name).toBe('Praesto');
    expect(assistant.avatar).toMatch(/\/api\/images\/assistant\/org-1\?v=h1$/);
  });

  it('falls back to the tenant-wide view when the customer has none', () => {
    const assistant = clientChatAssistant(null, tenantView);
    expect(assistant.name).toBe('Tenant Bot');
    expect(assistant.avatar).toMatch(/\/api\/images\/assistant\/tenant$/);
  });

  it("keeps name and face from one view: a customer view with no avatar does not borrow the tenant's", () => {
    const assistant = clientChatAssistant(view({ organizationId: 'org-1', assistantName: 'Praesto' }), tenantView);
    expect(assistant).toEqual({ name: 'Praesto', avatar: undefined });
  });

  it('is Fae with no avatar when nothing is set', () => {
    expect(clientChatAssistant(null, null)).toEqual({ name: ASSISTANT_CONFIG.FAE.name, avatar: undefined });
    expect(clientChatAssistant(view({ assistantName: '  ' }), null).name).toBe(ASSISTANT_CONFIG.FAE.name);
  });
});

describe('assistantAuthor', () => {
  it("authors the receipt as the assistant, with the customer's avatar", () => {
    const author = assistantAuthor(clientChatAssistant(customerView, tenantView));
    expect(author).toMatchObject({ name: 'Praesto', assistantType: ASSISTANT_CONFIG.FAE.type, authorType: 'fae' });
    expect(author.avatar).toMatch(/\/api\/images\/assistant\/org-1\?v=h1$/);
  });

  it('carries no avatar when none is set, so the lib draws the Fae mark', () => {
    const author = assistantAuthor(clientChatAssistant(null, null));
    expect(author).toEqual({
      name: ASSISTANT_CONFIG.FAE.name,
      assistantType: ASSISTANT_CONFIG.FAE.type,
      authorType: 'fae',
    });
    expect('avatar' in author).toBe(false);
  });
});

describe('withAssistantAvatar', () => {
  const avatar = 'https://tenant.test/api/images/assistant/org-1?v=h1';
  const row = (message: Partial<ChatMessage>): ChatMessage => ({ id: 'm-1', role: 'assistant', parts: [], ...message });

  it("gives the assistant's turns its face", () => {
    expect(withAssistantAvatar(row({}), avatar).metadata?.author?.avatar).toBe(avatar);
    const named = row({ metadata: { author: { name: 'Praesto', authorType: 'fae' } } });
    expect(withAssistantAvatar(named, avatar).metadata?.author).toEqual({ name: 'Praesto', authorType: 'fae', avatar });
  });

  it('leaves a turn that has a picture, a person turn and the no-avatar case alone', () => {
    const pictured = row({ metadata: { author: { avatar: 'https://other.test/a.png' } } });
    expect(withAssistantAvatar(pictured, avatar)).toBe(pictured);
    const endUser = row({ role: 'user', metadata: { author: { authorType: 'user' } } });
    expect(withAssistantAvatar(endUser, avatar)).toBe(endUser);
    const technician = row({ metadata: { author: { authorType: 'admin' } } });
    expect(withAssistantAvatar(technician, avatar)).toBe(technician);
    const plain = row({});
    expect(withAssistantAvatar(plain, undefined)).toBe(plain);
  });
});
