/**
 * A menu shortcut on the session's timeline: Ctrl+Alt+Del in any order is its
 * own action, every other combo goes by a label the server accepts.
 */
import { describe, expect, it } from 'vitest';
import { buildCombo, DEFAULT_REMOTE_SHORTCUTS, SHORTCUT_MODIFIERS, shortcutAction } from './remote-shortcuts';

const SERVER_LABEL = /^[A-Za-z0-9+ ]{1,40}$/;

describe('shortcutAction', () => {
  it('reports Ctrl+Alt+Del as its own action, whatever the order it was stored in', () => {
    expect(shortcutAction('alt+ctrl+del')).toEqual({ action: 'CTRL_ALT_DEL' });
    expect(shortcutAction('ctrl+alt+delete')).toEqual({ action: 'CTRL_ALT_DEL' });
  });

  it('reports any other combo as a menu shortcut by its label', () => {
    expect(shortcutAction('shift+win+m')).toEqual({
      action: 'SHORTCUT_SENT',
      label: 'Shift + Win + M',
      source: 'MENU',
    });
  });

  it('labels every default and the longest custom combo the way the server accepts', () => {
    const combos = [
      ...DEFAULT_REMOTE_SHORTCUTS.map(shortcut => shortcut.combo),
      buildCombo([...SHORTCUT_MODIFIERS], 'right'),
    ];
    const labels = combos.flatMap(combo => {
      const action = shortcutAction(combo);
      return action.action === 'SHORTCUT_SENT' ? [action.label] : [];
    });
    expect(labels.length).toBe(combos.length - 1);
    for (const label of labels) expect(label).toMatch(SERVER_LABEL);
  });
});
