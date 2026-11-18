import { describe, expect, it } from 'vitest';
import { buildFaeChatPreviewMessages } from './fae-chat-preview-messages';

describe('buildFaeChatPreviewMessages', () => {
  it('signs every assistant message with the given name and avatar', () => {
    const messages = buildFaeChatPreviewMessages('Fae', 'https://example.test/a.png');
    const assistants = messages.filter(message => message.role === 'assistant');
    expect(assistants.length).toBeGreaterThan(0);
    for (const message of assistants) {
      expect(message.metadata?.author).toMatchObject({
        name: 'Fae',
        assistantType: 'fae',
        avatar: 'https://example.test/a.png',
      });
    }
  });

  it('uses no avatar when none is given', () => {
    const [, assistant] = buildFaeChatPreviewMessages('Fae');
    expect(assistant.metadata?.author).toMatchObject({ avatar: null });
  });

  it('stamps every message with the same time and gives each its own id', () => {
    const messages = buildFaeChatPreviewMessages('Fae');
    const stamps = new Set(messages.map(message => message.metadata?.createdAt));
    expect(stamps.size).toBe(1);
    expect(new Date([...stamps][0] as string).getMinutes()).toBe(47);
    expect(new Set(messages.map(message => message.id)).size).toBe(messages.length);
  });

  it('shows an approved command and a hand-off to a technician', () => {
    const parts = buildFaeChatPreviewMessages('Fae').flatMap(message => message.parts);
    const tool = parts.find(part => part.type === 'dynamic-tool');
    expect(tool).toMatchObject({ state: 'approval-responded', approval: { approved: true } });
    expect(parts.some(part => part.type === 'data-ticket-escalated')).toBe(true);
  });
});
