/**
 * Mingo's home, a new chat: the greeting, and "What to ask?" (the hub's `/what-can-you-do`) under it, which leads
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
/** "What to ask?"'s label as the hub's command catalog names it; null: the hub lists no such command. */
let whatToAskLabel: string | null = 'What can you do?';
/** The catalog has not answered yet: whether there is an entry is not known. */
let whatToAskPending = false;
vi.mock('../hooks/use-what-to-ask-label', () => ({
  useWhatToAsk: () => ({ label: whatToAskLabel, pending: whatToAskPending }),
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
  useMingoSheetStore.setState({ outsidePage: null, newChatPage: null, listOpen: false, listAfterNavigation: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  whatToAskLabel = 'What can you do?';
  whatToAskPending = false;
  act(() => root.unmount());
  container.remove();
});

describe('MingoNewChat', () => {
  it('draws no "What to ask?" when the hub lists no such command', () => {
    whatToAskLabel = null;
    act(() => root.render(<MingoNewChat />));
    expect([...container.querySelectorAll('a, button')].some(el => el.textContent === 'What can you do?')).toBe(false);
    // The catalog has answered: nothing is held for an entry that is not coming.
    expect(container.querySelector('[data-what-to-ask-place]')).toBeNull();
  });

  it("holds the button's place while the hub's catalog is read, and hands it to the button", () => {
    whatToAskLabel = null;
    whatToAskPending = true;
    act(() => root.render(<MingoNewChat />));
    // The lib's button skeleton, at the default Button's own height.
    const place = container.querySelector('[data-what-to-ask-place]');
    expect(place?.className).toContain('h-11');
    expect(place?.className).toContain('md:h-12');
    expect([...container.querySelectorAll('a, button')].some(el => el.textContent === 'What can you do?')).toBe(false);

    whatToAskLabel = 'What can you do?';
    whatToAskPending = false;
    act(() => root.render(<MingoNewChat />));
    expect(container.querySelector('[data-what-to-ask-place]')).toBeNull();
    expect([...container.querySelectorAll('a, button')].some(el => el.textContent === 'What can you do?')).toBe(true);
  });

  it('greets, and leads to "What to ask?" under the label the hub names it as the full chat', () => {
    act(() => root.render(<MingoNewChat />));
    expect(container.querySelector('h1')?.textContent).toBe('Morning, Ann');

    const link = [...container.querySelectorAll('a')].find(a => a.textContent === 'What can you do?');
    expect(link?.getAttribute('href')).toBe(routes.mingo.whatToAsk);
  });

  it("marks the greeting and the button with Mingo's identity, as every Mingo icon", () => {
    act(() => root.render(<MingoNewChat />));
    const heading = container.querySelector('h1')?.parentElement;
    const link = [...container.querySelectorAll('a')].find(a => a.textContent === 'What can you do?');
    expect(heading?.querySelector('[data-agent-mark="mingo"]')).not.toBeNull();
    expect(link?.querySelector('[data-agent-mark="mingo"]')).not.toBeNull();
    // No glyph of its own: the identity is the one icon.
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('leads a phone back to the page it came from, with the chat list it was opened from over it', () => {
    viewport.mdUp = false;
    useMingoSheetStore.setState({ newChatPage: '/devices' });
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

  it('has no "Back" on a desktop, nor on a phone that did not start the chat over a page', () => {
    useMingoSheetStore.setState({ newChatPage: '/devices' });
    act(() => root.render(<MingoNewChat />));
    expect(container.textContent).not.toContain('Back');

    viewport.mdUp = false;
    useMingoSheetStore.setState({ outsidePage: '/devices', newChatPage: null });
    act(() => root.render(<MingoNewChat />));
    expect(container.textContent).not.toContain('Back');
  });
});
