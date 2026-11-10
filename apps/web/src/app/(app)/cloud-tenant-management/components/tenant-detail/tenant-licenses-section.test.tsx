/**
 * The phone sorts the licences in a window (the header sorts from `content-md`). A direction applies as it is picked;
 * Apply must keep it and Reset clear it.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryLicenseSortField, DirectoryProvider } from '@/generated/schema-enums';

// Vitest runs no Relay Babel transform, so the tag resolves to its compiled artifact, as the transform makes it.
vi.mock('react-relay', async importOriginal => {
  const query = (await import('@/__generated__/tenantLicensesSectionQuery.graphql')).default;
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return { ...actual.default, ...actual, graphql: () => query };
});

import { TenantLicensesSection } from './tenant-licenses-section';

const ALPHA = { id: 'sku-a', name: 'Alpha', assigned: 5, purchased: 10, unused: 5, free: false };
const BETA = { id: 'sku-b', name: 'Beta', assigned: 1, purchased: 10, unused: 9, free: false };

let container: HTMLDivElement;
let root: Root;

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};
const dialog = () => document.querySelector('[role="dialog"]');
const click = (element: Element | null | undefined) => {
  expect(element).toBeTruthy();
  act(() => (element as HTMLElement).click());
};
const button = (scope: ParentNode | null, text: string) =>
  [...(scope?.querySelectorAll('button') ?? [])].find(node => node.textContent === text);
/** The licence names in the order the table draws them. */
const order = () => (container.textContent ?? '').match(/Alpha|Beta/g);

async function pickAssignedInTheWindow() {
  click(container.querySelector('[aria-label="Sort licences"]'));
  // The column's row in the window: none → ascending.
  const label = [...(dialog()?.querySelectorAll('span') ?? [])].find(node => node.textContent === 'Assigned');
  click(label?.parentElement);
  await settle();
}

describe('TenantLicensesSection sort window', () => {
  beforeEach(() => {
    const Observer = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    globalThis.ResizeObserver = Observer as never;
    globalThis.IntersectionObserver = Observer as never;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as never;
    // The server sorts: by assigned when asked, by name otherwise.
    const fetchFn = vi.fn(async (_request: unknown, variables: { orderBy?: { field: string } | null }) => ({
      data: {
        directoryConnection: {
          id: 'c-1',
          licenseSummary: { assigned: 6 },
          licenses: variables.orderBy?.field === DirectoryLicenseSortField.ASSIGNED ? [BETA, ALPHA] : [ALPHA, BETA],
        },
      },
    }));
    const environment = new Environment({
      network: Network.create(fetchFn as never),
      store: new Store(new RecordSource()),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <TenantLicensesSection id="c-1" provider={DirectoryProvider.MICROSOFT_365} />
        </RelayEnvironmentProvider>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the direction picked when Apply closes the window', async () => {
    await settle();
    expect(order()).toEqual(['Alpha', 'Beta']);
    await pickAssignedInTheWindow();
    expect(order()).toEqual(['Beta', 'Alpha']);

    click(button(dialog(), 'Apply Filters'));
    await settle();
    expect(dialog()?.getAttribute('data-state')).not.toBe('open');
    expect(order()).toEqual(['Beta', 'Alpha']);
  });

  it('clears the sort on Reset', async () => {
    await settle();
    await pickAssignedInTheWindow();
    click(button(dialog(), 'Reset Filters'));
    await settle();
    expect(order()).toEqual(['Alpha', 'Beta']);
  });
});
