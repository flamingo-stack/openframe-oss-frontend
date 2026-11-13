/**
 * The Manhattan v2 left sidebar's rows (parity P2, P8): New Chat runs the launcher's new
 * chat, as the Mingo-first "New chat" row did, and closes the phone drawer; in the rail
 * the chats icon expands the sidebar, expanded the history section shows instead.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManhattanChatsSection, ManhattanStartWorkRow } from './manhattan-chats-sidebar';

const { launcher, closeMenu } = vi.hoisted(() => ({
  launcher: { startNewChat: vi.fn() },
  closeMenu: vi.fn(),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({ TimeTrackerHeaderButton: () => null }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/navigation', () => ({
  NavigationSidebarActionRow: ({
    label,
    onClick,
    disabled,
    count,
    countTone,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    count?: number;
    countTone?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-count={count} data-tone={countTone}>
      {label}
    </button>
  ),
  NotificationsBellButton: () => null,
}));
vi.mock('@/app/(app)/mingo/stores/mingo-launcher-store', () => ({
  useMingoLauncherStore: { getState: () => launcher },
}));
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => true }));
vi.mock('@/app/components/mingo-shell/mobile-menu-store', () => ({ closeMobileMenu: closeMenu }));
vi.mock('@/app/components/mingo-shell/mingo-account-popover', () => ({ MingoAccountPopover: () => null }));
vi.mock('@/app/components/mingo-shell/mingo-sidebar-history', () => ({
  MingoSidebarHistory: ({ density }: { density?: string }) => <p>history {density}</p>,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  launcher.startNewChat.mockReset();
  closeMenu.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name) ?? null;

describe('ManhattanStartWorkRow', () => {
  it('starts a new chat through the launcher and closes the phone drawer', () => {
    act(() => root.render(<ManhattanStartWorkRow minimized={false} active={false} />));
    act(() => button('New Chat')?.click());
    expect(launcher.startNewChat).toHaveBeenCalledOnce();
    expect(closeMenu).toHaveBeenCalledOnce();
  });

  it('is disabled behind the paywall', () => {
    act(() => root.render(<ManhattanStartWorkRow minimized={false} active={false} disabled />));
    expect(button('New Chat')?.disabled).toBe(true);
  });

  it('draws no counter: "Needs you" has no one number of its rows', () => {
    act(() => root.render(<ManhattanStartWorkRow minimized={false} active={false} />));
    expect(button('New Chat')?.dataset.count).toBeUndefined();
    expect(button('New Chat')?.dataset.tone).toBeUndefined();
  });
});

describe('ManhattanChatsSection', () => {
  it('is the chats icon in the rail, and expands the sidebar', () => {
    const onExpand = vi.fn();
    act(() => root.render(<ManhattanChatsSection minimized onExpand={onExpand} />));
    expect(container.textContent).not.toContain('history');
    act(() => button('Chats')?.click());
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('is the compact history expanded', () => {
    act(() => root.render(<ManhattanChatsSection minimized={false} onExpand={vi.fn()} />));
    expect(container.textContent).toContain('history compact');
  });
});
