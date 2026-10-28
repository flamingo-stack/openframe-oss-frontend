/**
 * The Mingo-first dashboard: what it renders (greeting, "Needs you", the dashboard's sections — Tickets
 * on SaaS only, with filtered links, Incidents between Tickets and Customers). The quick
 * actions are the dock's (`mingo-dock-quick-actions.test.tsx`).
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoDashboard } from './mingo-dashboard';

const { isSaas, setup } = vi.hoisted(() => ({ isSaas: { value: true }, setup: { active: false } }));

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
vi.mock('@/app/(app)/onboarding/hooks/use-initial-setup-active', () => ({
  useInitialSetupActive: () => setup.active,
}));
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

// The lib's truncation-aware labels measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  isSaas.value = true;
  setup.active = false;
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
    root.render(<MingoDashboard />);
  });
}

describe('MingoDashboard', () => {
  it('greets by first name and part of the day', async () => {
    await renderHome();
    expect(container.querySelector('h1')?.textContent).toBe('Morning, Ann');
  });

  it("renders the dashboard's sections, tickets with filtered links, and no Initial Setup card", async () => {
    await renderHome();
    const text = container.textContent ?? '';
    expect(text).not.toContain('setup card');
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
    expect(at('devices section')).toBeGreaterThan(at('needs you card'));
    expect(at('tickets section')).toBeLessThan(at('incidents section'));
    expect(at('incidents section')).toBeLessThan(at('customers section'));
  });

  it('hides Tickets outside SaaS', async () => {
    isSaas.value = false;
    await renderHome();
    expect(container.textContent).not.toContain('tickets section');
    expect(container.textContent).toContain('devices section');
  });

  it('carries no quick actions or "What to ask Mingo?": they are the new chat\'s', async () => {
    await renderHome();
    expect(container.querySelector('[aria-label="Quick actions"]')).toBeNull();
    expect(container.textContent).not.toContain('What to ask Mingo?');
  });

  it("does not dim the sections while the tenant's Initial Setup runs: there is no setup card here", async () => {
    setup.active = true;
    await renderHome();
    const devices = [...container.querySelectorAll('p')].find(node => node.textContent === 'devices section');
    expect(devices?.closest('[aria-hidden="true"]')).toBeNull();
    expect(devices?.closest('.opacity-40')).toBeNull();
  });
});
