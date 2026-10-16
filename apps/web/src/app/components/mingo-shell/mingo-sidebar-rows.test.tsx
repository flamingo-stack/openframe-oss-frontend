/**
 * The Mingo rows on top of the Mingo-first sidebar are the lib's action rows: "New chat"
 * (outline) starts a new chat on home, "Needs approval" links to its page with the
 * pending count and the active pill there. Both close the phone drawer they may sit in.
 */

import type { NavigationSidebarActionRowProps } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { MingoSidebarRows } from './mingo-sidebar-rows';
import { useMobileMenuStore } from './mobile-menu-store';

const { push, rows, nav, startNewDialog } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  rows: [] as NavigationSidebarActionRowProps[],
  nav: { pathname: '/devices', pending: 0 },
  startNewDialog: vi.fn(async () => {}),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => nav.pathname }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/navigation', () => ({
  NavigationSidebarActionRow: (props: NavigationSidebarActionRowProps) => {
    rows.push(props);
    return null;
  },
}));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChat: () => ({ chat: { state: { startNewDialog } } }),
}));
vi.mock('./use-pending-approval-count', () => ({ usePendingApprovalCount: () => nav.pending }));

let container: HTMLDivElement;
let root: Root;

function render(props: { minimized?: boolean; disabled?: boolean } = {}) {
  rows.length = 0;
  act(() => root.render(<MingoSidebarRows minimized={props.minimized ?? false} disabled={props.disabled ?? false} />));
  const byLabel = (label: string) => {
    const row = rows.findLast(candidate => candidate.label === label);
    if (!row) throw new Error(`no "${label}" row`);
    return row;
  };
  return { newChat: byLabel('New chat'), approvals: byLabel('Needs approval') };
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.pathname = '/devices';
  nav.pending = 0;
  useMobileMenuStore.setState({ open: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoSidebarRows', () => {
  it('draws New chat as the outline action and Needs approval as a link with its count', () => {
    nav.pending = 3;
    const { newChat, approvals } = render({ minimized: true });

    expect(newChat).toMatchObject({ variant: 'outline', minimized: true, disabled: false });
    expect(newChat.href).toBeUndefined();
    expect(approvals).toMatchObject({ href: routes.approvals, count: 3, active: false, minimized: true });
  });

  it('lights Needs approval on its own page', () => {
    nav.pathname = routes.approvals;
    expect(render().approvals.active).toBe(true);
  });

  it('starts a new chat on home and closes the phone drawer', () => {
    const { newChat } = render();
    useMobileMenuStore.setState({ open: true });

    act(() => newChat.onClick?.({} as never));

    expect(startNewDialog).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(routes.mingo.home);
    expect(useMobileMenuStore.getState().open).toBe(false);
  });

  it('closes the phone drawer from Needs approval, also on its own page', () => {
    nav.pathname = routes.approvals;
    const { approvals } = render();
    useMobileMenuStore.setState({ open: true });

    act(() => approvals.onClick?.({} as never));
    expect(useMobileMenuStore.getState().open).toBe(false);
  });

  it('disables both rows behind the lock', () => {
    const { newChat, approvals } = render({ disabled: true });
    expect(newChat.disabled).toBe(true);
    expect(approvals.disabled).toBe(true);
  });
});
