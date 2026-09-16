// User-managed keyboard shortcuts for the remote desktop "Apply Shortcut" menu.
// A shortcut is stored as a `comboToSequence`-compatible combo string
// ('shift+win+m') — the same format `MeshDesktop.sendKeyCombo` consumes, so the
// stored value is the wire contract and the label is always derived from it.

export interface RemoteShortcut {
  id: string;
  combo: string;
}

export const REMOTE_SHORTCUTS_STORAGE_KEY = 'remote-desktop:shortcuts';

export const DEFAULT_REMOTE_SHORTCUTS: RemoteShortcut[] = [
  { id: 'alt-ctrl-del', combo: 'alt+ctrl+del' },
  { id: 'win-m', combo: 'win+m' },
  { id: 'win-down', combo: 'win+down' },
  { id: 'win-up', combo: 'win+up' },
  { id: 'shift-win-m', combo: 'shift+win+m' },
  { id: 'win-l', combo: 'win+l' },
  { id: 'win-r', combo: 'win+r' },
  { id: 'ctrl-w', combo: 'ctrl+w' },
];

// Toast descriptions for the well-known combos; custom shortcuts fall back to a
// generic message.
export const SHORTCUT_DESCRIPTIONS: Record<string, string> = {
  'alt+ctrl+del': 'Secure attention sequence',
  'win+m': 'Minimize all windows',
  'win+down': 'Minimize window',
  'win+up': 'Maximize window',
  'shift+win+m': 'Restore minimized windows',
  'win+l': 'Lock workstation',
  'win+r': 'Open Run dialog',
  'ctrl+w': 'Close window',
};

export const SHORTCUT_MODIFIERS = ['shift', 'alt', 'ctrl', 'win'] as const;
export type ShortcutModifier = (typeof SHORTCUT_MODIFIERS)[number];

const MODIFIER_SET = new Set<string>(SHORTCUT_MODIFIERS);

// Non-modifier tokens `comboToSequence` understands beyond letters/digits/F-keys.
const NAMED_KEY_TOKENS = new Set(['esc', 'tab', 'enter', 'space', 'del', 'up', 'down', 'left', 'right']);

const KEY_ALIASES: Record<string, string> = {
  escape: 'esc',
  delete: 'del',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  return: 'enter',
};

/**
 * Normalize free-text key input ('M', 'f5', 'Delete') to a combo token, or
 * `null` when `comboToSequence` would not understand it.
 */
export function normalizeKeyToken(input: string): string | null {
  const token = KEY_ALIASES[input.trim().toLowerCase()] ?? input.trim().toLowerCase();
  if (!token || MODIFIER_SET.has(token)) return null;
  if (/^[a-z0-9]$/.test(token)) return token;
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(token)) return token;
  if (NAMED_KEY_TOKENS.has(token)) return token;
  return null;
}

/** Compose a combo string from checked modifiers + a normalized key token. */
export function buildCombo(modifiers: ShortcutModifier[], keyToken: string): string {
  const ordered = SHORTCUT_MODIFIERS.filter(m => modifiers.includes(m));
  return [...ordered, keyToken].join('+');
}

const TOKEN_LABELS: Record<string, string> = {
  shift: 'Shift',
  alt: 'Alt',
  ctrl: 'Ctrl',
  win: 'Win',
  esc: 'Esc',
  tab: 'Tab',
  enter: 'Enter',
  space: 'Space',
  del: 'Del',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
};

/** 'shift+win+m' → 'Shift + Win + M' (matches the design's list labels). */
export function comboLabel(combo: string): string {
  return combo
    .split('+')
    .map(token => TOKEN_LABELS[token] ?? token.toUpperCase())
    .join(' + ');
}
