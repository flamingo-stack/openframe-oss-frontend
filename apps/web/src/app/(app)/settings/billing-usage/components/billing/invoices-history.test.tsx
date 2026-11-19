/**
 * The invoice history table follows the app's one table flag: the grid table where it is on, card rows where it is
 * off, loading rows until it is answered. Billing: with the flag off the table is what it was (the same columns, the
 * same link to the invoice), and in both layouts it lists the same invoices with the same figures.
 */

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';

interface SeenColumn {
  id?: string;
  accessorKey?: string;
  size?: number;
  meta?: { width?: string; hideAt?: string; align?: string; gridKind?: string };
}

/** The columns the table handed `useDataTable`: what the two layouts read of them. */
const seen = vi.hoisted(() => ({ columns: [] as SeenColumn[] }));

vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => {
  const actual = await importOriginal<{ useDataTable: (options: { columns: SeenColumn[] }) => unknown }>();
  return {
    ...actual,
    useDataTable: (options: { columns: SeenColumn[] }) => {
      seen.columns = options.columns;
      return actual.useDataTable(options);
    },
  };
});

// Vitest runs no Relay Babel transform. The section reads its invoices through a fragment and an `@inline` one: here
// both hand back the plain rows the test gives it.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  useFragment: (_fragment: unknown, key: unknown) => key,
  readInlineData: (_fragment: unknown, key: unknown) => key,
}));

import { InvoicesHistory } from './invoices-history';

const SUBSCRIPTION = {
  pendingInvoices: [
    {
      id: 'in_1',
      invoiceNumber: 'INV-0042',
      status: 'PAID',
      amountDue: 120,
      dueDate: '2026-11-01T00:00:00Z',
      createdAt: '2026-10-01T00:00:00Z',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/in_1',
    },
    {
      id: 'in_2',
      invoiceNumber: null,
      status: 'OPEN',
      amountDue: 80,
      dueDate: null,
      createdAt: '2026-11-01T00:00:00Z',
      hostedInvoiceUrl: null,
    },
  ],
};

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};
/** What the card layout reads of each column. */
const cardMeta = () =>
  seen.columns.map(({ id, accessorKey, meta }) => [id ?? accessorKey, meta?.width, meta?.hideAt, meta?.align]);
/** The grid's action columns. */
const gridActions = () =>
  seen.columns.filter(column => column.meta?.gridKind === 'action').map(({ id, size }) => [id, size]);

beforeEach(() => {
  stubLayoutApis();
  seen.columns = [];
});

afterEach(() => {
  unmountAll();
  answerTableFlag('loading');
  window.localStorage.clear();
});

async function history() {
  const mounted = mount(<InvoicesHistory subscription={SUBSCRIPTION as never} />);
  await settle();
  return mounted.container;
}
/** What a viewer reads of the invoices, whatever the layout: numbers, statuses, amounts, links. */
const figures = (container: HTMLElement) => ({
  numbers: (container.textContent ?? '').match(/INV-\d{4}/g),
  statuses: (container.textContent ?? '').match(/Paid|Unpaid/g),
  amounts: (container.textContent ?? '').match(/\$[\d.,]+/g),
  links: [...container.querySelectorAll('a[aria-label="Open invoice"]')].map(link => link.getAttribute('href')),
  noLink: container.querySelectorAll('button[aria-label="This invoice has no payment link yet"]').length,
});

describe('InvoicesHistory', () => {
  it('flag off: card rows, nothing of the grid', async () => {
    answerTableFlag('off');
    const container = await history();

    expect(container.textContent).toContain('INV-0042');
    expect(hasGridMarkup(container)).toBe(false);
    // The phone's filter button is the card rows': below `content-md` they have no header.
    expect(container.querySelector('[aria-label="Open filters"]')).not.toBeNull();
  });

  it('flag on: the grid table with its gear, at its natural height, the invoice link in its action column', async () => {
    answerTableFlag('on');
    const container = await history();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['invoiceNumber', 'dueDate', 'amountDue', 'status']);
    expect(gridSettingsGear(container)).not.toBeNull();
    // A section of the billing page: the page scrolls, the table has no viewport of its own.
    expect(gridViewport(container)).toBeNull();
    expect(gridActions()).toEqual([['actions', 56]]);
    // The count is drawn once, above the table: the grid header does not draw the card header's right slot.
    expect((container.textContent ?? '').match(/2 results/g)).toHaveLength(1);
    // The grid header carries the funnel and the sort at every width.
    expect(container.querySelector('[aria-label="Open filters"]')).toBeNull();
  });

  it('both layouts list the same invoices with the same figures and links', async () => {
    answerTableFlag('off');
    const cards = figures(await history());
    unmountAll();
    answerTableFlag('on');
    const grid = figures(await history());

    expect(cards.numbers).toEqual(['INV-0042']);
    expect(cards.statuses).toEqual(['Paid', 'Unpaid']);
    expect(cards.links).toEqual(['https://invoice.stripe.com/i/in_1']);
    expect(cards.noLink).toBe(1);
    expect(grid).toEqual(cards);
  });

  it('flag not answered: loading rows, no invoice drawn in either layout', async () => {
    answerTableFlag('loading');
    const container = await history();

    expect(container.textContent).not.toContain('INV-0042');
    expect(hasGridMarkup(container)).toBe(false);
  });

  it("keeps the card layout's columns: the link column keeps its own width", async () => {
    answerTableFlag('off');
    await history();

    expect(cardMeta()).toEqual([
      ['invoiceNumber', 'flex-1 min-w-0', undefined, undefined],
      ['dueDate', 'flex-1 min-w-0', 'lg', undefined],
      ['amountDue', 'flex-1 min-w-0', undefined, undefined],
      ['status', 'flex-1 min-w-0', 'md', undefined],
      ['actions', 'w-14 shrink-0 flex-none', undefined, 'right'],
    ]);
  });
});
