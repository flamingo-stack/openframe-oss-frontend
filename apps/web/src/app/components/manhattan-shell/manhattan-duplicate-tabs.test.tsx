/**
 * The Manhattan v2 navigation lists Scripts, Scheduled Scripts, Policies and Queries, so their
 * pages draw no tab bar of their own there; the other shells keep it.
 */

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonitoringTabNavigation } from '@/app/(app)/monitoring/components/tabs/monitoring-tabs';
import { ScriptsTabNavigation } from '@/app/(app)/scripts/shared/components/scripts-tabs';
import { ManhattanDockContext } from './manhattan-dock-context';

vi.mock('next/navigation', () => ({
  usePathname: () => '/monitoring',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/(app)/monitoring/components/tabs/policies', () => ({ Policies: () => null }));
vi.mock('@/app/(app)/monitoring/components/tabs/queries', () => ({ Queries: () => null }));

// TabNavigation measures its tabs; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

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

const inShell = (manhattan: boolean, bar: ReactNode) => (
  <ManhattanDockContext.Provider value={manhattan}>{bar}</ManhattanDockContext.Provider>
);

describe('duplicate tab bars', () => {
  it.each([
    ['Scripts', <ScriptsTabNavigation key="scripts" activeTab="list" />],
    ['Monitoring', <MonitoringTabNavigation key="monitoring" activeTab="policies" />],
  ])('%s draws no tab bar in the Manhattan v2 shell and keeps it elsewhere', (_, bar) => {
    act(() => root.render(inShell(true, bar)));
    expect(container.innerHTML).toBe('');

    act(() => root.render(inShell(false, bar)));
    expect(container.textContent).not.toBe('');
  });
});
