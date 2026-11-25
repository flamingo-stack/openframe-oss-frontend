/**
 * The phone sorts the licences in a window (the header sorts from `content-md`). A direction applies as it is picked;
 * Apply must keep it and Reset clear it.
 *
 * The table follows the app's one table flag: card rows where it is off (the sort window's cases), the grid table
 * where it is on, loading rows until it is answered.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
} from '@/app/hooks/use-table-layout.fixtures';
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

/** Mounts the section over a server that sorts by assigned when asked, by name otherwise. */
function renderSection() {
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
}

function unmountSection() {
  act(() => root.unmount());
  container.remove();
  answerTableFlag('loading');
  window.localStorage.clear();
}

describe('TenantLicensesSection sort window', () => {
  beforeEach(() => {
    // The window belongs to the card rows: the flag answered, off.
    answerTableFlag('off');
    renderSection();
  });

  afterEach(unmountSection);

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

describe('TenantLicensesSection table layout', () => {
  afterEach(unmountSection);

  it('flag off: card rows, nothing of the grid', async () => {
    answerTableFlag('off');
    renderSection();
    await settle();

    expect(order()).toEqual(['Alpha', 'Beta']);
    expect(hasGridMarkup(container)).toBe(false);
  });

  it('flag on: the grid table with its gear, at its natural height, and no phone sort button', async () => {
    answerTableFlag('on');
    renderSection();
    await settle();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['license', 'assigned', 'unused']);
    expect(order()).toEqual(['Alpha', 'Beta']);
    expect(gridSettingsGear(container)).not.toBeNull();
    // A section of a longer page: the page scrolls, the table has no viewport of its own.
    expect(gridViewport(container)).toBeNull();
    // The grid header sorts at every width.
    expect(container.querySelector('[aria-label="Sort licences"]')).toBeNull();
  });

  it('flag not answered: loading rows, no licence drawn in either layout', async () => {
    answerTableFlag('loading');
    renderSection();
    await settle();

    expect(order()).toBeNull();
    expect(hasGridMarkup(container)).toBe(false);
  });
});
