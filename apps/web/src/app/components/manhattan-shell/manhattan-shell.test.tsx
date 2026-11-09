/**
 * The Manhattan v2 shell's switch (flag `manhattan-v2`) and its left sidebar's user row:
 * only an answered "on" draws v2; the footer keeps the account, the one time tracker, the
 * bell and adds the collapse button, laid out as a row expanded and a column in the rail.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { ManhattanChatsFooter } from './manhattan-chats-sidebar';
import { useManhattanShell } from './use-manhattan-shell';

const { seen } = vi.hoisted(() => ({
  seen: { tracker: 0, bell: 0, account: [] as Array<Record<string, unknown>> },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({
  TimeTrackerHeaderButton: () => {
    seen.tracker += 1;
    return null;
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/navigation', () => ({
  NavigationSidebarActionRow: () => null,
  NotificationsBellButton: () => {
    seen.bell += 1;
    return null;
  },
}));
vi.mock('@/app/components/mingo-shell/mingo-account-popover', () => ({
  MingoAccountPopover: (props: Record<string, unknown>) => {
    seen.account.push(props);
    return null;
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
  useFeatureFlagsStore.setState({ flags: {}, isLoaded: false });
});

function Probe({ mingoShell }: { mingoShell: boolean }) {
  return <p>{useManhattanShell(mingoShell) ? 'v2' : 'v1'}</p>;
}

describe('useManhattanShell', () => {
  it.each([
    ['flags loading', { flags: {}, isLoaded: false }, true, 'v1'],
    ['flag absent', { flags: {}, isLoaded: true }, true, 'v1'],
    ['flag off', { flags: { 'manhattan-v2': false }, isLoaded: true }, true, 'v1'],
    ['flag on, OSS tenant', { flags: { 'manhattan-v2': true }, isLoaded: true }, false, 'v1'],
    ['flag on, SaaS tenant', { flags: { 'manhattan-v2': true }, isLoaded: true }, true, 'v2'],
  ])('%s → %s', (_name, state, mingoShell, expected) => {
    useFeatureFlagsStore.setState(state);
    act(() => root.render(<Probe mingoShell={mingoShell} />));
    expect(container.textContent).toBe(expected);
  });
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
