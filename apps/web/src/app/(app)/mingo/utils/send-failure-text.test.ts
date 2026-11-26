import { describe, expect, it } from 'vitest';
import { MESSAGE_REFUSED_TEXT, MESSAGE_TOO_LONG_TEXT, mingoSendFailureText } from './send-failure-text';

describe('mingoSendFailureText', () => {
  it('words the over-limit refusal as the ai-agent sends it', () => {
    const error = new Error('sendMessage.input.content: Message content must be between 1 and 10000 characters');
    expect(mingoSendFailureText(error)).toBe(MESSAGE_TOO_LONG_TEXT);
  });

  it('words the over-limit refusal in any casing (the error row once showed it upper-cased)', () => {
    const error = new Error('SENDMESSAGE.INPUT.CONTENT: MESSAGE CONTENT MUST BE BETWEEN 1 AND 10000 CHARACTERS');
    expect(mingoSendFailureText(error)).toBe(MESSAGE_TOO_LONG_TEXT);
  });

  it('words any other validation refusal plainly, with no "try again"', () => {
    const text = mingoSendFailureText(new Error('sendMessage.input.currentPage.title: size must be between 0 and 200'));
    expect(text).toBe(MESSAGE_REFUSED_TEXT);
    expect(text).not.toMatch(/try again/i);
  });

  it("keeps a refusal the backend already words for the user (a mutation's userErrors)", () => {
    expect(mingoSendFailureText(new Error('This chat is archived.'))).toBe('This chat is archived.');
  });

  it('keeps a connection failure as it is', () => {
    const text = 'The chat could not connect. Please try again.';
    expect(mingoSendFailureText(new Error(text))).toBe(text);
  });

  it('keeps a non-Error failure readable', () => {
    expect(mingoSendFailureText('Request failed with status 502')).toBe('Request failed with status 502');
  });

  it('does not take a sentence with a colon for a validation path', () => {
    expect(mingoSendFailureText(new Error('Request failed: timeout'))).toBe('Request failed: timeout');
  });
});
