/**
 * Pins the overlay toolbar's buttons to Figma 1755-95622: who is watching,
 * actions, chat, fullscreen, settings - all icon buttons, the chat one only when
 * the session has a chat, and pressed while the chat is open. Windowed, the same
 * bar offers Enter fullscreen and drops the logo; hidden, it slides away but
 * keeps holding the auto-hide while something interacts with it, the viewers
 * list included.
 */
import type { RemoteSessionViewer } from '@flamingo-stack/openframe-frontend-core/components/features';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionToolbar } from './session-toolbar';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;
const onToggleChat = vi.fn();
const hold = vi.fn();

const VIEWERS: RemoteSessionViewer[] = [
  { id: 'tech-maria', name: 'Maria Host', isHost: true, isYou: true },
  { id: 'tech-dana', name: 'Dana' },
];

function render(
  chat: { open: boolean; unread?: boolean } | null,
  {
    fullscreen = true,
    visible = true,
    viewers,
  }: { fullscreen?: boolean; visible?: boolean; viewers?: RemoteSessionViewer[] } = {},
) {
  act(() =>
    root.render(
      <SessionToolbar
        deviceName="Anthony's Device"
        displayMenuGroups={[]}
        currentDisplayLabel="Display 1"
        actionsMenuGroups={[]}
        onOpenSettings={vi.fn()}
        fullscreen={fullscreen}
        onToggleFullscreen={vi.fn()}
        chatOpen={chat?.open}
        chatUnread={chat?.unread}
        onToggleChat={chat ? onToggleChat : undefined}
        viewers={viewers}
        visible={visible}
        hold={hold}
      />,
    ),
  );
}

/** The last hold the viewers list asked for (focus and hover holds come and go around it). */
const viewersHeld = () => hold.mock.calls.filter(([key]) => key === 'viewers-menu').at(-1)?.[1];

const viewersTrigger = () =>
  Array.from(container.querySelectorAll('button')).find(button =>
    button.getAttribute('aria-label')?.startsWith('In this session'),
  );

const bar = () => container.querySelector<HTMLElement>('[data-state]');

const chatButton = () =>
  Array.from(container.querySelectorAll('button')).find(button =>
    button.getAttribute('aria-label')?.startsWith('Open chat'),
  );

const buttonLabels = () =>
  Array.from(container.querySelectorAll('button')).map(button => button.getAttribute('aria-label'));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('SessionToolbar', () => {
  it('orders actions, chat, exit fullscreen, settings - all icon buttons', () => {
    render({ open: false });
    expect(buttonLabels()).toEqual(['Actions', 'Open chat', 'Exit fullscreen', 'Settings']);
    expect(container.textContent).not.toMatch(/Open Chat|Close Chat/);
  });

  it('marks the chat button pressed while the chat is open, and toggles it', () => {
    render({ open: true });
    const chat = container.querySelector<HTMLButtonElement>('[aria-label="Close chat"]');
    expect(chat?.getAttribute('aria-pressed')).toBe('true');
    act(() => chat?.click());
    expect(onToggleChat).toHaveBeenCalledTimes(1);
  });

  it('has no chat button for a session without a chat', () => {
    render(null);
    expect(buttonLabels()).toEqual(['Actions', 'Exit fullscreen', 'Settings']);
  });

  it('marks the chat toggle while the end user wrote with the chat closed', () => {
    render({ open: false, unread: true });
    // The core lib's UnreadDot on the chat icon.
    expect(chatButton()?.querySelector('.bg-ods-warning')).not.toBeNull();
    expect(buttonLabels()).toContain('Open chat (new message)');

    render({ open: false });
    expect(chatButton()?.querySelector('.bg-ods-warning')).toBeNull();
  });

  it('windowed: offers Enter fullscreen in the same slot and drops the logo', () => {
    render({ open: false }, { fullscreen: false });
    expect(buttonLabels()).toEqual(['Actions', 'Open chat', 'Enter fullscreen', 'Settings']);
    expect(container.querySelector('svg.opacity-50')).toBeNull();

    render({ open: false }, { fullscreen: true });
    expect(container.querySelector('svg.opacity-50')).not.toBeNull();
  });

  it('hidden: slides out of the way without leaving the DOM, so a Tab still reaches it', () => {
    render(null, { visible: false });
    expect(bar()?.dataset.state).toBe('hidden');
    expect(bar()?.className).toContain('pointer-events-none');
    expect(buttonLabels()).toEqual(['Actions', 'Exit fullscreen', 'Settings']);

    render(null, { visible: true });
    expect(bar()?.dataset.state).toBe('visible');
    expect(bar()?.className).not.toContain('pointer-events-none');
  });

  it('holds the auto-hide while the pointer or the focus is on it', () => {
    render(null);
    const element = bar() as HTMLElement;
    // React synthesizes onPointerEnter/Leave from the bubbling over/out pair.
    act(() => element.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })));
    expect(hold).toHaveBeenLastCalledWith('hover', true);
    act(() => element.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body })));
    expect(hold).toHaveBeenLastCalledWith('hover', false);

    const settings = container.querySelector<HTMLButtonElement>('[aria-label="Settings"]');
    act(() => settings?.focus());
    expect(hold).toHaveBeenLastCalledWith('focus', true);
    act(() => settings?.blur());
    expect(hold).toHaveBeenLastCalledWith('focus', false);
  });

  it('shows who is watching ahead of the actions, only while somebody watches', () => {
    render({ open: false }, { viewers: VIEWERS });
    expect(buttonLabels()).toEqual([
      'In this session: Maria Host (host), Dana',
      'Actions',
      'Open chat',
      'Exit fullscreen',
      'Settings',
    ]);

    render({ open: false }, { viewers: [] });
    expect(viewersTrigger()).toBeUndefined();
  });

  it('holds the auto-hide while the viewers list is open, and lets go when it closes or everyone left', () => {
    render(null, { viewers: VIEWERS });
    act(() => {
      viewersTrigger()?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }),
      );
    });
    expect(viewersHeld()).toBe(true);
    act(() => {
      document
        .querySelector('[role="menu"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }));
    });
    expect(viewersHeld()).toBe(false);

    act(() => {
      viewersTrigger()?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }),
      );
    });
    expect(viewersHeld()).toBe(true);
    render(null, { viewers: [] });
    expect(viewersHeld()).toBe(false);
  });

  it('lets go of the pointer and focus holds the list took when everyone leaves with it open', () => {
    render(null, { viewers: VIEWERS });
    act(() => {
      viewersTrigger()?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }),
      );
    });
    // The open list has the focus: React counts the portal as inside the bar, so the bar holds for the focus.
    act(() => document.querySelector<HTMLElement>('[role="menu"]')?.focus());
    expect(hold).toHaveBeenLastCalledWith('focus', true);

    hold.mockClear();
    render(null, { viewers: [] });
    expect(hold).toHaveBeenCalledWith('viewers-menu', false);
    expect(hold).toHaveBeenCalledWith('focus', false);
    expect(hold).toHaveBeenCalledWith('hover', false);
  });
});
