/**
 * The Manhattan v2 shell's left sidebar user row: the footer keeps the account, the one
 * time tracker, the bell and adds the collapse button, laid out as a row expanded and a
 * column in the rail.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManhattanChatsFooter } from './manhattan-chats-sidebar';

const { seen } = vi.hoisted(() => ({
  seen: { tracker: 0, bell: 0, account: [] as Array<Record<string, unknown>> },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({
  TimeTrackerHeaderButton: () => {
    seen.tracker += 1;
    return <span data-cell="tracker" />;
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/navigation', () => ({
  NavigationSidebarActionRow: () => null,
  NotificationsBellButton: () => {
    seen.bell += 1;
    return <span data-cell="bell" />;
  },
}));
vi.mock('@/app/components/mingo-shell/mingo-account-popover', () => ({
  MingoAccountPopover: (props: Record<string, unknown>) => {
    seen.account.push(props);
    return <span data-cell="account" />;
  },
}));
vi.mock('@/app/components/mingo-shell/mingo-sidebar-history', () => ({ MingoSidebarHistory: () => null }));
// The "New Chat" row's count reads the Relay-backed "Needs you" sources: not what this file tests.
vi.mock('@/app/(app)/mingo/home/needs-you/needs-you-card', () => ({
  useNeedsYouCount: () => ({ count: 0, sources: null }),
}));
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => true }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  seen.tracker = 0;
  seen.bell = 0;
  seen.account = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ManhattanChatsFooter', () => {
  function render(props: Partial<Parameters<typeof ManhattanChatsFooter>[0]> = {}) {
    const onToggleCollapsed = props.onToggleCollapsed ?? vi.fn();
    act(() =>
      root.render(
        <ManhattanChatsFooter
          minimized={props.minimized ?? false}
          locked={props.locked ?? false}
          ownsHeaderCells={props.ownsHeaderCells ?? true}
          inDrawer={props.inDrawer ?? false}
          onToggleCollapsed={onToggleCollapsed}
        />,
      ),
    );
    return onToggleCollapsed;
  }
  const collapseButton = () => container.querySelector<HTMLButtonElement>('button[aria-label$="chats"]');

  it('keeps the account popover, one tracker and the bell, and collapses', () => {
    const onToggle = render();
    expect(seen.account.at(-1)).toMatchObject({ collapsed: false, locked: false });
    expect(seen.tracker).toBe(1);
    expect(seen.bell).toBe(1);
    expect(collapseButton()?.getAttribute('aria-label')).toBe('Hide chats');
    act(() => collapseButton()?.click());
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('sets Worktime and the bell beside the avatar, the collapse button alone at the end', () => {
    render();
    const cell = (name: string) => container.querySelector(`[data-cell="${name}"]`);
    const group = cell('account')?.parentElement?.parentElement;
    expect(group?.contains(cell('tracker'))).toBe(true);
    expect(group?.contains(cell('bell'))).toBe(true);
    expect(group?.contains(collapseButton())).toBe(false);
    // In the row: the avatar's group first, the collapse button after it.
    const row = group?.parentElement;
    expect(row?.lastElementChild?.contains(collapseButton())).toBe(true);
    expect(seen.account.at(-1)).toMatchObject({ avatarOnly: true, logoutOnly: true });
  });

  it('expands from the rail', () => {
    render({ minimized: true });
    expect(collapseButton()?.getAttribute('aria-label')).toBe('Show chats');
    // The rail centres its buttons, and the avatar with them.
    expect(seen.account.at(-1)).toMatchObject({ collapsed: true, collapsedAlign: 'center' });
  });

  it('mounts no tracker or bell below md or in the phone drawer, and no collapse in the drawer', () => {
    render({ ownsHeaderCells: false });
    expect(seen.tracker).toBe(0);
    render({ inDrawer: true });
    expect(seen.tracker).toBe(0);
    expect(collapseButton()).toBeNull();
  });

  it('hands the lock to the account (Log out only)', () => {
    render({ locked: true });
    expect(seen.account.at(-1)).toMatchObject({ locked: true });
  });
});
