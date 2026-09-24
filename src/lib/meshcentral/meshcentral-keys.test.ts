import { describe, expect, it } from 'vitest';
import { comboToSequence, isSecureAttentionCombo } from './meshcentral-keys';

describe('isSecureAttentionCombo', () => {
  it.each(['ctrl+alt+del', 'alt+ctrl+del', 'del+alt+ctrl', 'CTRL+ALT+DEL', 'ctrl + alt + delete', 'alt+ctrl+delete'])(
    'matches %s regardless of order, case, spacing and the del/delete alias',
    combo => {
      expect(isSecureAttentionCombo(combo)).toBe(true);
    },
  );

  it.each(['ctrl+del', 'ctrl+alt+d', 'ctrl+alt+shift+del', 'ctrl+alt+del+del', 'ctrl+ctrl+del', 'win+m', ''])(
    'rejects %s',
    combo => {
      expect(isSecureAttentionCombo(combo)).toBe(false);
    },
  );
});

describe('comboToSequence', () => {
  it('presses in order and releases in reverse, with Win as an extended key', () => {
    expect(comboToSequence('win+m')).toEqual([
      { action: 1, vk: 0x5b, extended: true },
      { action: 1, vk: 0x4d, extended: false },
      { action: 2, vk: 0x4d, extended: false },
      { action: 2, vk: 0x5b, extended: true },
    ]);
  });

  it('returns null for an unknown token', () => {
    expect(comboToSequence('ctrl+bogus')).toBeNull();
  });
});
