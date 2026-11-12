/**
 * Start Work, Mingo's home in the Manhattan v2 shell (plan D16): the greeting, "What to ask
 * Mingo?" and "Needs you", no onboarding banner; `live` off, no reads and "Needs you" loading.
 * Also: `/mingo` draws it only in v2, and `/dashboard` leads to it there (plan D15).
 */

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/app/(app)/dashboard/page';
import MingoHomePage from '@/app/(app)/mingo/page';
import { ManhattanDockContext } from '@/app/components/manhattan-shell/manhattan-dock-context';
import { routes } from '@/lib/routes';
import { ManhattanStartWork } from './manhattan-start-work';

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn(), push: vi.fn(), back: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@flamingo-stack/openframe-frontend-core/components', async importOriginal => ({
  ...(await importOriginal<object>()),
  AgentMark: ({ agent }: { agent: string }) => <span data-agent-mark={agent} />,
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { firstName: string } }) => unknown) =>
    selector({ user: { firstName: 'Ann' } }),
}));
vi.mock('@/app/hooks/use-now', () => ({ useNow: () => new Date(2026, 9, 16, 9, 30).getTime() }));
vi.mock('@/app/(app)/dashboard/components/dashboard-content', () => ({
  IntroBanner: () => <p>intro banner</p>,
  default: () => <p>oss dashboard</p>,
}));
vi.mock('./needs-you/needs-you-card', () => ({
  NeedsYouCard: () => <p>needs you live</p>,
  NeedsYouPanel: ({ loading }: { loading?: boolean }) => <p>{loading ? 'needs you loading' : 'needs you'}</p>,
}));
vi.mock('./mingo-dashboard', () => ({ MingoDashboard: () => <p>mingo dashboard</p> }));
vi.mock('./mingo-new-chat', () => ({ MingoNewChat: () => <p>new chat</p> }));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => true,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  router.replace.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ManhattanStartWork', () => {
  it('greets, leads to "What to ask Mingo?", then "Needs you", without the onboarding banner', () => {
    act(() => root.render(<ManhattanStartWork />));
    expect(container.querySelector('h1')?.textContent).toBe('Morning, Ann');
    const link = [...container.querySelectorAll('a')].find(a => a.textContent === 'What to ask Mingo?');
    expect(link?.getAttribute('href')).toBe(routes.mingo.whatToAsk);
    expect(container.textContent).not.toContain('intro banner');
    expect(container.textContent).toContain('needs you live');
  });

  it('reads nothing while held: "Needs you" loading', () => {
    act(() => root.render(<ManhattanStartWork live={false} />));
    expect(container.textContent).not.toContain('intro banner');
    expect(container.textContent).toContain('needs you loading');
  });
});

describe('the v2 routes', () => {
  const inShell = (manhattan: boolean, page: ReactNode) => (
    <ManhattanDockContext.Provider value={manhattan}>{page}</ManhattanDockContext.Provider>
  );

  it('/mingo is Start Work in v2 and a new chat otherwise', () => {
    act(() => root.render(inShell(true, <MingoHomePage />)));
    expect(container.querySelector('h1')?.textContent).toBe('Morning, Ann');
    act(() => root.render(inShell(false, <MingoHomePage />)));
    expect(container.textContent).toBe('new chat');
  });

  it('/dashboard leads to Start Work in v2 and stays the dashboard otherwise', () => {
    act(() => root.render(inShell(true, <DashboardPage />)));
    expect(router.replace).toHaveBeenCalledWith(routes.mingo.home);
    expect(container.textContent).toBe('');

    router.replace.mockClear();
    act(() => root.render(inShell(false, <DashboardPage />)));
    expect(router.replace).not.toHaveBeenCalled();
    expect(container.textContent).toBe('mingo dashboard');
  });
});
