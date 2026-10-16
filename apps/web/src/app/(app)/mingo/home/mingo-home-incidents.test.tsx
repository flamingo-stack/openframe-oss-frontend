/**
 * The home's Incidents section: gated like the sidebar entry (SaaS + `insights`, loading
 * while the flag is unanswered), the current total in its title and one card per severity
 * opening the list filtered to it.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { MingoHomeIncidents } from './mingo-home-incidents';

const env = vi.hoisted(() => ({
  saas: true,
  queries: 0,
  data: {
    insightFilters: {
      severities: [
        { value: 'CRITICAL', count: 2 },
        { value: 'MEDIUM', count: 4 },
        { value: 'INFO', count: 1 },
      ],
      filteredCount: 7 as number | null,
    },
  },
}));

vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => env.saas,
}));
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useLazyLoadQuery: () => {
    env.queries += 1;
    return env.data;
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  env.saas = true;
  env.queries = 0;
  useFeatureFlagsStore.setState({ flags: { insights: true }, isLoaded: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => {
    root.render(<MingoHomeIncidents />);
  });
}

const cardHrefs = () =>
  Array.from(container.querySelectorAll('a'))
    .map(a => a.getAttribute('href'))
    .filter(href => href?.includes('severity='));

describe('MingoHomeIncidents', () => {
  it('titles the current total and links a card per severity to the filtered list', async () => {
    await render();
    expect(container.querySelector('h1')?.textContent).toBe('Incidents · 7 current');
    expect(cardHrefs()).toEqual([
      routes.incidents.filtered({ severity: ['CRITICAL'] }),
      routes.incidents.filtered({ severity: ['HIGH'] }),
      routes.incidents.filtered({ severity: ['MEDIUM'] }),
      routes.incidents.filtered({ severity: ['LOW'] }),
    ]);
    const text = container.textContent ?? '';
    // A severity the facet does not list counts zero; INFO has no card.
    expect(text).toMatch(/CRITICAL\s*2/);
    expect(text).toMatch(/HIGH\s*0/);
    expect(text).toMatch(/MEDIUM\s*4/);
    expect(text).not.toContain('INFO');
  });

  it('links the whole list from its header', async () => {
    await render();
    expect(Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href'))).toContain(
      routes.incidents.list,
    );
  });

  it('is absent outside SaaS', async () => {
    env.saas = false;
    await render();
    expect(container.innerHTML).toBe('');
    expect(env.queries).toBe(0);
  });

  it('is absent with the flag off', async () => {
    useFeatureFlagsStore.setState({ flags: { insights: false }, isLoaded: true });
    await render();
    expect(container.innerHTML).toBe('');
    expect(env.queries).toBe(0);
  });

  it('loads while the flag is unanswered, without querying', async () => {
    useFeatureFlagsStore.setState({ flags: {}, isLoaded: false });
    await render();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(env.queries).toBe(0);
  });
});
