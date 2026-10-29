/**
 * The Mingo rows on top of the Mingo-first sidebar are the lib's action rows: "Dashboard"
 * links to the dashboard, "Needs approval" to its page with the pending count, each with
 * the active pill on its page. Both close the phone drawer they may sit in. "New chat"
 * is not one of them: it heads the chat history (`MingoNewChatRow`).
 */

import type { NavigationSidebarActionRowProps } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { MingoSidebarRows } from './mingo-sidebar-rows';
import { useMobileMenuStore } from './mobile-menu-store';

const { rows, nav } = vi.hoisted(() => ({
  rows: [] as NavigationSidebarActionRowProps[],
  nav: { pathname: '/devices', pending: 0 },
}));

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/navigation', () => ({
  NavigationSidebarActionRow: (props: NavigationSidebarActionRowProps) => {
    rows.push(props);
    return null;
  },
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
  return { dashboard: byLabel('Dashboard'), approvals: byLabel('Needs approval') };
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
  it('draws Needs approval as a link with its count', () => {
    nav.pending = 3;
    const { approvals } = render({ minimized: true });

    expect(approvals).toMatchObject({ href: routes.approvals, count: 3, active: false, minimized: true });
  });

  it('lights Needs approval on its own page', () => {
    nav.pathname = routes.approvals;
    expect(render().approvals.active).toBe(true);
  });

  it('draws Dashboard then Needs approval, with no New chat, Dashboard lit on the dashboard', () => {
    nav.pathname = '/dashboard/';
    const { dashboard } = render();

    expect(rows.map(row => row.label)).toEqual(['Dashboard', 'Needs approval']);
    expect(dashboard).toMatchObject({ href: routes.dashboard, active: true });
    expect(render().approvals.active).toBe(false);
  });

  it('closes the phone drawer from Needs approval, also on its own page', () => {
    nav.pathname = routes.approvals;
    const { approvals } = render();
    useMobileMenuStore.setState({ open: true });

    act(() => approvals.onClick?.({} as never));
    expect(useMobileMenuStore.getState().open).toBe(false);
  });

  it('disables every row behind the lock', () => {
    const { dashboard, approvals } = render({ disabled: true });
    expect(dashboard.disabled).toBe(true);
    expect(approvals.disabled).toBe(true);
  });
});
