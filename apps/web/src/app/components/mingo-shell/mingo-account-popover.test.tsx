/**
 * The account menu of the Mingo-first sidebar: Settings, Help Center, Log out — and,
 * while there are unread support replies, "Support replies" with their count, opening the
 * ticket with the newest one (the footer has no ticket-alerts button: it cut the name).
 */

import type {
  AccountPopoverEntry,
  AccountPopoverProps,
} from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { MingoAccountPopover } from './mingo-account-popover';

const { seen, live } = vi.hoisted(() => ({
  seen: { props: null as AccountPopoverProps | null },
  live: { value: null as { authed: boolean; unreadTotal: number; nextUnreadTicketId: string | null } | null },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/navigation', () => ({
  AccountPopover: (props: AccountPopoverProps) => {
    seen.props = props;
    return null;
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/tickets', () => ({
  useOptionalTicketLive: () => live.value,
  buildTicketOpenHref: (base: string, id: string) => `${base}?ticket=${id}`,
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { firstName: string; lastName: string } }) => unknown) =>
    selector({ user: { firstName: 'Ann', lastName: 'Lee' } }),
}));

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<MingoAccountPopover collapsed={false} locked={false} />));
  if (!seen.props) throw new Error('the account popover was not rendered');
  return seen.props.items.filter(
    (entry): entry is Exclude<AccountPopoverEntry, { type: 'divider' }> => entry.type !== 'divider',
  );
}

beforeEach(() => {
  live.value = null;
  seen.props = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoAccountPopover', () => {
  it('offers Settings, Help Center and Log out, and no workspace host', () => {
    const items = render();
    expect(items.map(item => item.label)).toEqual(['Settings', 'Help Center', 'Log out']);
    expect(seen.props?.subtitle).toBeUndefined();
    expect(seen.props?.name).toBe('Ann Lee');
  });

  it('adds Support replies with the unread count, opening the newest unread ticket', () => {
    live.value = { authed: true, unreadTotal: 9, nextUnreadTicketId: 't-7' };
    const [replies] = render();
    expect(replies).toMatchObject({
      id: 'support-replies',
      label: 'Support replies',
      count: 9,
      href: `${routes.helpCenter.tickets}?ticket=t-7`,
    });
  });

  it('shows no Support replies while nothing is unread or signed out', () => {
    live.value = { authed: true, unreadTotal: 0, nextUnreadTicketId: null };
    expect(render().some(item => item.id === 'support-replies')).toBe(false);
    live.value = { authed: false, unreadTotal: 3, nextUnreadTicketId: 't-1' };
    expect(render().some(item => item.id === 'support-replies')).toBe(false);
  });
});
