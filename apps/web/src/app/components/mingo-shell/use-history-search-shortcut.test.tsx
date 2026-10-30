/**
 * ⌘K / Ctrl+K anywhere opens the chat-history search in the Mingo-first shell — but only
 * the modifier of the visitor's system, never over a surface that owns the keyboard, and
 * never once something on the page has taken the key.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forwardsKeyboard, isHistorySearchShortcut, useHistorySearchShortcut } from './use-history-search-shortcut';

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0';

type ShortcutEvent = Parameters<typeof isHistorySearchShortcut>[0];

function keyEvent(init: Partial<ShortcutEvent>): ShortcutEvent {
  const { target, ...rest } = init;
  return {
    key: 'k',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    target: target ?? document.body,
    ...rest,
  };
}

describe('isHistorySearchShortcut', () => {
  it('takes ⌘K on Apple systems and Ctrl+K elsewhere, and only that modifier', () => {
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true }), true)).toBe(true);
    expect(isHistorySearchShortcut(keyEvent({ key: 'K', metaKey: true }), true)).toBe(true);
    // On a Mac, Ctrl+K is the text fields' "delete to the end of the line".
    expect(isHistorySearchShortcut(keyEvent({ ctrlKey: true }), true)).toBe(false);
    expect(isHistorySearchShortcut(keyEvent({ ctrlKey: true }), false)).toBe(true);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true }), false)).toBe(false);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, ctrlKey: true }), true)).toBe(false);
  });

  it('ignores other keys and other chords', () => {
    expect(isHistorySearchShortcut(keyEvent({ key: 'j', metaKey: true }), true)).toBe(false);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, altKey: true }), true)).toBe(false);
  });

  it('stands back when the page already took the key', () => {
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, defaultPrevented: true }), true)).toBe(false);
  });

  it('stands back inside an editor, a terminal or a rich-text field, and works from a plain input', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div class="monaco-editor"><textarea id="monaco"></textarea></div>
      <div class="xterm"><textarea id="xterm"></textarea></div>
      <div contenteditable="true"><p id="rich">text</p></div>
      <input id="plain" />`;
    document.body.appendChild(host);
    const at = (id: string) => host.querySelector(`#${id}`);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, target: at('monaco') }), true)).toBe(false);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, target: at('xterm') }), true)).toBe(false);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, target: at('rich') }), true)).toBe(false);
    expect(isHistorySearchShortcut(keyEvent({ metaKey: true, target: at('plain') }), true)).toBe(true);
    host.remove();
  });
});

describe('forwardsKeyboard', () => {
  it('names the remote desktop, where every key goes to the remote machine', () => {
    expect(forwardsKeyboard('/devices/details/remote-desktop')).toBe(true);
    expect(forwardsKeyboard('/devices/details')).toBe(false);
    expect(forwardsKeyboard('/mingo')).toBe(false);
    expect(forwardsKeyboard(null)).toBe(false);
  });
});

describe('useHistorySearchShortcut', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onTrigger = vi.fn();

  function Probe({ enabled }: { enabled: boolean }) {
    useHistorySearchShortcut(enabled, onTrigger);
    return null;
  }

  function press(init: KeyboardEventInit) {
    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true, ...init });
    document.body.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    onTrigger.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('fires on ⌘K on a Mac and keeps the browser from acting on it', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(MAC_UA);
    act(() => root.render(<Probe enabled />));
    const event = press({ metaKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    press({ ctrlKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('fires on Ctrl+K on Windows', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WINDOWS_UA);
    act(() => root.render(<Probe enabled />));
    press({ ctrlKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('binds nothing while disabled, and unbinds when it becomes disabled', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WINDOWS_UA);
    act(() => root.render(<Probe enabled={false} />));
    const untouched = press({ ctrlKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
    expect(untouched.defaultPrevented).toBe(false);

    act(() => root.render(<Probe enabled />));
    press({ ctrlKey: true });
    act(() => root.render(<Probe enabled={false} />));
    press({ ctrlKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('calls the latest callback without re-binding', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WINDOWS_UA);
    const first = vi.fn();
    const second = vi.fn();
    function Swappable({ callback }: { callback: () => void }) {
      useHistorySearchShortcut(true, callback);
      return null;
    }
    act(() => root.render(<Swappable callback={first} />));
    act(() => root.render(<Swappable callback={second} />));
    press({ ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
