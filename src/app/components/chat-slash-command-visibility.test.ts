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
  it('keeps the complete Hub command catalog when V3 remote tools are enabled', () => {
    expect(applySlashCommandVisibility({ commands }, true).commands).toEqual(commands);
  });

  it('keeps only the V2 command set when V3 remote tools are disabled', () => {
    expect(applySlashCommandVisibility({ commands }, false).commands).toEqual([
      { id: 'docs' },
      { id: 'my-tickets' },
      { id: 'open-ticket' },
      { id: 'update-ticket' },
    ]);
  });
});
