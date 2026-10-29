/**
 * Mingo's home, a new chat: the greeting, and "What to ask Mingo?" under it, which leads
 * to the full chat with the suggestions (`routes.mingo.whatToAsk`) in Mingo's colours.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { MingoNewChat } from './mingo-new-chat';

vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { firstName: string } }) => unknown) =>
    selector({ user: { firstName: 'Ann' } }),
}));
// 09:30 local time.
vi.mock('@/app/hooks/use-now', () => ({ useNow: () => new Date(2026, 9, 16, 9, 30).getTime() }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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
});
