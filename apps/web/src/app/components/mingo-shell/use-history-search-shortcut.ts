'use client';

import { useVisitorOs } from '@flamingo-stack/openframe-frontend-core/hooks';
import { usesCommandKey } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useRef } from 'react';

/**
 * Surfaces that own the keyboard: an editor or a terminal binds ⌘K / Ctrl+K itself
 * (Monaco's chord prefix, readline's kill-line in the remote shell), and a
 * contenteditable editor uses it for links.
 */
const KEYBOARD_OWNING_SURFACES = '.monaco-editor, .xterm, [contenteditable=""], [contenteditable="true"]';

/**
 * Pages that forward every key to a remote machine from a `window` listener of their
 * own (the remote desktop, `lib/meshcentral/meshcentral-desktop.ts`). Listeners on one
 * target run in registration order and the shell registers first, so the page's
 * `preventDefault` comes too late to tell this one to stand back: the route has to.
 */
const KEY_FORWARDING_PATHS = ['/devices/details/remote-desktop'] as const;

export function forwardsKeyboard(pathname: string | null): boolean {
  return pathname !== null && KEY_FORWARDING_PATHS.some(path => pathname.startsWith(path));
}

type ShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'defaultPrevented' | 'target'
>;

/**
 * ⌘K on Apple systems, Ctrl+K elsewhere — only that modifier, as the lib's own Mingo
 * shortcut reads it: on a Mac Ctrl+K is the text fields' "delete to the end of the line".
 * Not when something on the page already took the key, nor inside a surface that owns
 * the keyboard.
 */
export function isHistorySearchShortcut(event: ShortcutEvent, commandKey: boolean): boolean {
  if (event.defaultPrevented || event.altKey || event.shiftKey) return false;
  if (event.key.toLowerCase() !== 'k') return false;
  const modifier = commandKey ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!modifier) return false;
  const target = event.target;
  return !(target instanceof Element && target.closest(KEYBOARD_OWNING_SURFACES));
}

/**
 * ⌘K / Ctrl+K anywhere opens the chat-history search: `onTrigger` reveals the sidebar
 * and opens the field. Bound while `enabled` (the Mingo-first shell, off the pages that
 * forward the keyboard). The browser's own binding (Ctrl+K → the address bar's search)
 * is suppressed for the shortcut it handles.
 */
export function useHistorySearchShortcut(enabled: boolean, onTrigger: () => void): void {
  const visitor = useVisitorOs();
  const commandKey = visitor.known && usesCommandKey(visitor.os);

  // The latest callback, for a listener that must not re-bind on every render.
  const triggerRef = useRef(onTrigger);
  useEffect(() => {
    triggerRef.current = onTrigger;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isHistorySearchShortcut(event, commandKey)) return;
      event.preventDefault();
      triggerRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, commandKey]);
}
