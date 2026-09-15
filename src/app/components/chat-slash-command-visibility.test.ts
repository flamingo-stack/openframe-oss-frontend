import { describe, expect, it } from 'vitest';
import { applySlashCommandVisibility } from './chat-slash-command-visibility';

const commands = [
  { id: 'docs' },
  { id: 'my-tickets' },
  { id: 'open-ticket' },
  { id: 'update-ticket' },
  { id: 'roadmap' },
  { id: 'webinars' },
];

describe('applySlashCommandVisibility', () => {
  it('keeps the whole server-owned catalog under Guide Mode V3', () => {
    const payload = { commands };
    // Identity, not just equality: the caller reads it as "leave the response
    // alone" and skips re-serializing it.
    expect(applySlashCommandVisibility(payload, true)).toBe(payload);
  });

  it('trims to the V2 command set when remote tools are off', () => {
    expect(applySlashCommandVisibility({ commands }, false).commands).toEqual([
      { id: 'docs' },
      { id: 'my-tickets' },
      { id: 'open-ticket' },
      { id: 'update-ticket' },
    ]);
  });

  it('returns the payload unchanged when the V2 catalog needs no trimming', () => {
    const payload = { commands: [{ id: 'docs' }, { id: 'my-tickets' }] };
    expect(applySlashCommandVisibility(payload, false)).toBe(payload);
  });

  it('passes a shape it does not recognise straight through', () => {
    const payload = {};
    expect(applySlashCommandVisibility(payload, false)).toBe(payload);
  });
});
