/**
 * Mingo's home: what it renders (greeting, "Needs you", the dashboard's Initial Setup card
 * and sections — Tickets on SaaS only, with filtered links, Incidents between Tickets and
 * Customers — quick actions, "What to ask Mingo?"), and that every Mingo chip SENDS
 * through the session's chat state in a new chat instead of navigating anywhere itself.
 */

import type { WhatToAskContent } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiQuickAction } from '../../settings/ai-settings/types/ai-settings';
import { MingoHome } from './mingo-home';

const { sendInNewDialog, isSaas, chatState, quickActions, whatToAsk } = vi.hoisted(() => ({
  sendInNewDialog: vi.fn(async (_text: string) => {}),
  isSaas: { value: true },
  chatState: { running: true },
  quickActions: { value: [] as AiQuickAction[] },
  // Stable across renders, like the real hook's `useCallback`.
  whatToAsk: { load: async (): Promise<WhatToAskContent> => ({ question: '', reply: '', groups: [] }) },
}));

vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => isSaas.value,
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { user: { firstName: string } }) => unknown) =>
    selector({ user: { firstName: 'Ann' } }),
}));
// 09:30 local time.
vi.mock('@/app/hooks/use-now', () => ({ useNow: () => new Date(2026, 9, 16, 9, 30).getTime() }));
vi.mock('@/app/(app)/onboarding/components/initial-setup-card', () => ({
  InitialSetupCard: () => <p>setup card</p>,
  InitialSetupSkeleton: () => null,
}));
vi.mock('@/app/(app)/onboarding/hooks/use-initial-setup-active', () => ({ useInitialSetupActive: () => false }));
vi.mock('@/app/(app)/dashboard/components/devices-overview', () => ({
  DevicesOverviewSection: () => <p>devices section</p>,
}));
vi.mock('@/app/(app)/dashboard/components/tickets-overview', () => ({
  TicketsOverviewSection: ({ filterLinks }: { filterLinks?: boolean }) => (
    <p>{`tickets section${filterLinks ? ' (filtered links)' : ''}`}</p>
  ),
}));
vi.mock('@/app/(app)/dashboard/components/customers-overview', () => ({
  CustomersOverviewSection: () => <p>customers section</p>,
}));
// Both run Relay queries (`graphql` needs the compiler's transform); they have tests of their own.
vi.mock('./needs-you/needs-you-card', () => ({ NeedsYouCard: () => <p>needs you card</p> }));
vi.mock('./mingo-home-incidents', () => ({ MingoHomeIncidents: () => <p>incidents section</p> }));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-quick-actions', () => ({ useMingoQuickActions: () => quickActions.value }));
// The real loader runs a Relay query (`graphql` needs the compiler's transform).
vi.mock('@/app/(app)/mingo/hooks/use-mingo-what-to-ask', () => ({ useMingoWhatToAsk: () => whatToAsk.load }));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({
  useMingoChat: () => ({ chat: chatState.running ? { sendInNewDialog } : null }),
}));

// The lib's truncation-aware labels measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sendInNewDialog.mockClear();
  isSaas.value = true;
  chatState.running = true;
  quickActions.value = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderHome() {
  await act(async () => {
    root.render(<MingoHome />);
  });
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(label));
  if (!match) throw new Error(`no button "${label}"`);
  return match;
}

describe('MingoHome', () => {
  it('greets by first name and part of the day', async () => {
    await renderHome();
    expect(container.querySelector('h1')?.textContent).toBe('Morning, Ann');
  });

  it("renders the dashboard's setup card and sections, tickets with filtered links", async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(text).toContain('setup card');
    expect(text).toContain('devices section');
    expect(text).toContain('tickets section (filtered links)');
    expect(text).toContain('customers section');
  });

  it('puts Needs you under the greeting, and Incidents between Tickets and Customers', async () => {
    await renderHome();
    const blocks = Array.from(container.querySelectorAll('h1, p')).map(node => node.textContent);
    const at = (label: string) => blocks.findIndex(text => text?.startsWith(label));
    expect(at('Morning, Ann')).toBe(0);
    expect(at('needs you card')).toBe(1);
    expect(at('setup card')).toBeGreaterThan(at('needs you card'));
    expect(at('tickets section')).toBeLessThan(at('incidents section'));
    expect(at('incidents section')).toBeLessThan(at('customers section'));
  });

  it('hides Tickets outside SaaS', async () => {
    isSaas.value = false;
    await renderHome();
    expect(container.textContent).not.toContain('tickets section');
    expect(container.textContent).toContain('devices section');
  });

  it('sends a quick action in a new chat', async () => {
    quickActions.value = [
      { id: 'qa-1', name: 'Machines online', instructions: 'List every online machine with its customer' },
    ];
    await renderHome();
    act(() => button('Machines online').click());
    expect(sendInNewDialog).toHaveBeenCalledExactlyOnceWith('List every online machine with its customer');
  });

  it('renders no quick actions section while there are none', async () => {
    await renderHome();
    expect(container.querySelector('[aria-label="Quick actions"]')).toBeNull();
  });

  it('sends a "What to ask Mingo?" prompt in a new chat', async () => {
    whatToAsk.load = async () => ({
      question: 'What can I ask you?',
      reply: 'Try one:',
      groups: [{ label: 'Check', prompts: [{ label: 'Why is LAPTOP-1 slow?', prompt: 'Why is @device:m-1 slow?' }] }],
    });
    await renderHome();
    act(() => button('Why is LAPTOP-1 slow?').click());
    expect(sendInNewDialog).toHaveBeenCalledExactlyOnceWith('Why is @device:m-1 slow?');
  });

  it('sends nothing while the chat state is not running', async () => {
    chatState.running = false;
    quickActions.value = [{ id: 'qa-1', name: 'Machines online', instructions: 'List machines' }];
    await renderHome();
    act(() => button('Machines online').click());
    expect(sendInNewDialog).not.toHaveBeenCalled();
  });
});
