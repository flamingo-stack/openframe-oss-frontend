/**
 * Mingo's home, a new chat: the greeting, and "What to ask Mingo?" under it, which leads
 * to the full chat with the suggestions (`routes.mingo.whatToAsk`), both in Mingo's colours.
 * On a phone reached from a page, "Back" leads back to it, the chat list open over it as it was left.
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
// The agent's mark, as the identity draws it: which agent, and where.
vi.mock('@flamingo-stack/openframe-frontend-core/components', async importOriginal => ({
  ...(await importOriginal<object>()),
  AgentMark: ({ agent, className }: { agent: string; className?: string }) => (
    <span data-agent-mark={agent} className={className} />
  ),
}));
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
  useMingoSheetStore.setState({ outsidePage: null, listOpen: false, listAfterNavigation: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoNewChat', () => {
  it('greets, and leads to "What to ask Mingo?" as the full chat', () => {
    act(() => root.render(<MingoNewChat />));
    expect(container.querySelector('h1')?.textContent).toBe('Morning, Ann');

    const link = [...container.querySelectorAll('a')].find(a => a.textContent === 'What to ask Mingo?');
    expect(link?.getAttribute('href')).toBe(routes.mingo.whatToAsk);
  });

  it("marks the greeting and the button with Mingo's identity, as every Mingo icon", () => {
    act(() => root.render(<MingoNewChat />));
    const heading = container.querySelector('h1')?.parentElement;
    const link = [...container.querySelectorAll('a')].find(a => a.textContent === 'What to ask Mingo?');
    expect(heading?.querySelector('[data-agent-mark="mingo"]')).not.toBeNull();
    expect(link?.querySelector('[data-agent-mark="mingo"]')).not.toBeNull();
    // No glyph of its own: the identity is the one icon.
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('leads a phone back to the page it came from, with the chat list it was opened from over it', () => {
    viewport.mdUp = false;
    useMingoSheetStore.setState({ outsidePage: '/devices' });
    act(() => root.render(<MingoNewChat />));
    const back = [...container.querySelectorAll('button')].find(b => b.textContent === 'Back');
    expect(back).toBeDefined();
    // No history entry to go back to in jsdom: the page it came from.
    act(() => back?.click());
    expect(router.push).toHaveBeenCalledWith('/devices');
    // The list opens once that page is on screen: "Start New Chat" and the chats, as it was left.
    expect(useMingoSheetStore.getState().listAfterNavigation).toBe(true);
    useMingoSheetStore.getState().navigated();
    expect(useMingoSheetStore.getState().listOpen).toBe(true);
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
