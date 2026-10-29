/**
 * Mingo's home, a new chat: the greeting, and "What to ask Mingo?" under it, which leads
 * to the full chat with the suggestions (`routes.mingo.whatToAsk`), both in Mingo's colours.
 * On a phone reached from a page, "Back" leads back to it.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { routes } from '@/lib/routes';
import { MingoNewChat } from './mingo-new-chat';

const { router, viewport } = vi.hoisted(() => ({
  router: { back: vi.fn(), push: vi.fn() },
  viewport: { mdUp: true as boolean | undefined },
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useMdUp: () => viewport.mdUp,
}));

vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { firstName: string } }) => unknown) =>
    selector({ user: { firstName: 'Ann' } }),
}));
// 09:30 local time.
vi.mock('@/app/hooks/use-now', () => ({ useNow: () => new Date(2026, 9, 16, 9, 30).getTime() }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  router.back.mockClear();
  router.push.mockClear();
  viewport.mdUp = true;
  useMingoSheetStore.setState({ outsidePage: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoNewChat', () => {
  it('greets, and leads to "What to ask Mingo?" as the full chat, with the coloured mark', () => {
    act(() => root.render(<MingoNewChat />));
    expect(container.querySelector('h1')?.textContent).toBe('Morning, Ann');

    const link = [...container.querySelectorAll('a')].find(a => a.textContent === 'What to ask Mingo?');
    expect(link?.getAttribute('href')).toBe(routes.mingo.whatToAsk);
    // The two-colour mark: its frame in the text colour, its eyes and corner in Mingo's cyan.
    const fills = [...(link?.querySelectorAll('svg [fill]') ?? [])].map(part => part.getAttribute('fill'));
    expect(fills).toContain('var(--color-text-primary)');
    expect(fills).toContain('var(--ods-flamingo-cyan-base)');
  });

  it('marks the greeting with the same coloured mark, drawn from the first frame', () => {
    act(() => root.render(<MingoNewChat />));
    const heading = container.querySelector('h1')?.parentElement;
    const fills = [...(heading?.querySelectorAll('svg [fill]') ?? [])].map(part => part.getAttribute('fill'));
    expect(fills).toContain('var(--color-text-primary)');
    expect(fills).toContain('var(--ods-flamingo-cyan-base)');
  });

  it('leads a phone back to the page it came from', () => {
    viewport.mdUp = false;
    useMingoSheetStore.setState({ outsidePage: '/devices' });
    act(() => root.render(<MingoNewChat />));
    const back = [...container.querySelectorAll('button')].find(b => b.textContent === 'Back');
    expect(back).toBeDefined();
    // No history entry to go back to in jsdom: the page it came from.
    act(() => back?.click());
    expect(router.push).toHaveBeenCalledWith('/devices');
  });

  it('has no "Back" on a desktop, nor on a phone that came from no page', () => {
    useMingoSheetStore.setState({ outsidePage: '/devices' });
    act(() => root.render(<MingoNewChat />));
    expect(container.textContent).not.toContain('Back');

    viewport.mdUp = false;
    useMingoSheetStore.setState({ outsidePage: null });
    act(() => root.render(<MingoNewChat />));
    expect(container.textContent).not.toContain('Back');
  });
});
