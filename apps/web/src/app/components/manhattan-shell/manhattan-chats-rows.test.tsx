/**
 * The Manhattan v2 left sidebar's rows (parity P2, P8): New Chat runs the launcher's new
 * chat, as the Mingo-first "New chat" row did, and closes the phone drawer; in the rail
 * the chats icon expands the sidebar, expanded the history section shows instead.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManhattanChatsSection, ManhattanStartWorkRow } from './manhattan-chats-sidebar';

const { launcher, closeMenu, needsYou } = vi.hoisted(() => ({
  launcher: { startNewChat: vi.fn() },
  closeMenu: vi.fn(),
  needsYou: { count: 0, enabled: [] as boolean[] },
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
vi.mock('@/app/(app)/mingo/home/needs-you/needs-you-card', () => ({
  useNeedsYouCount: (enabled: boolean) => {
    needsYou.enabled.push(enabled);
    return { count: needsYou.count, sources: null };
  },
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
  needsYou.count = 0;
  needsYou.enabled = [];
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

  it('is disabled behind the paywall, with no count and no reads', () => {
    needsYou.count = 3;
    act(() => root.render(<ManhattanStartWorkRow minimized={false} active={false} disabled />));
    expect(button('New Chat')?.disabled).toBe(true);
    expect(button('New Chat')?.dataset.count).toBe('0');
    expect(needsYou.enabled.every(enabled => !enabled)).toBe(true);
  });

  it('counts the rows of "Needs you" in a warning tag', () => {
    needsYou.count = 3;
    act(() => root.render(<ManhattanStartWorkRow minimized={false} active={false} />));
    expect(button('New Chat')?.dataset.count).toBe('3');
    expect(button('New Chat')?.dataset.tone).toBe('warning');
    expect(needsYou.enabled.at(-1)).toBe(true);
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
