/**
 * Manhattan v2's phone chat list as a panel from the left (`AppLayout` `mobileStartPanel`): open while the store's
 * list is up, closed through the store, nothing at all when the shell has no such list.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoPhoneChatsPanel } from './mingo-phone-chats-panel';
import { useMingoSheetStore } from './mingo-sheet-store';

vi.mock('next/navigation', () => ({ usePathname: () => '/devices/' }));
vi.mock('./mingo-phone-chat-list', () => ({ MingoPhoneChatList: () => <p>chat list</p> }));

let container: HTMLDivElement;
let root: Root;
/** Mounts the hook; the returned object always holds what it answered last. */
function mount(enabled: boolean) {
  const seen: { panel: ReturnType<typeof useMingoPhoneChatsPanel> } = { panel: undefined };
  function Probe() {
    seen.panel = useMingoPhoneChatsPanel(enabled);
    return <div>{seen.panel?.content}</div>;
  }
  act(() => root.render(<Probe />));
  return seen;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  act(() => useMingoSheetStore.getState().hideList());
});

describe('useMingoPhoneChatsPanel', () => {
  it('is nothing without the v2 shell and its Mingo button', () => {
    const seen = mount(false);
    expect(seen.panel).toBeUndefined();
  });

  it('opens with the list (the Mingo button), holds the chat list, and closes it through the store', () => {
    const seen = mount(true);
    expect(seen.panel?.open).toBe(false);
    expect(seen.panel?.label).toBe('Chats');
    expect(container.textContent).toContain('chat list');

    act(() => useMingoSheetStore.getState().showList());
    expect(seen.panel?.open).toBe(true);

    act(() => seen.panel?.onClose());
    expect(useMingoSheetStore.getState().listOpen).toBe(false);
    expect(seen.panel?.open).toBe(false);
  });
});
