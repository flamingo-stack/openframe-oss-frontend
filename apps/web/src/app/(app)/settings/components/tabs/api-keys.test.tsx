/**
 * The API keys table follows the app's one table flag: the grid table where it is on, card rows where it is off,
 * loading rows until it is answered. The grid is the page's main content (it fills the page) and has its gear; the row
 * menu is its action column, and the card layout's columns are what they were.
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

// The shared barrel reaches modules with Relay tags, which need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
}));

const KEY = {
  id: 'ak_live_7f3c',
  name: 'Billing export',
  description: 'Nightly export to the data warehouse',
  enabled: true,
  totalRequests: 1280,
  createdAt: '2026-10-01T09:30:00Z',
  expiresAt: null,
};

vi.mock('../../hooks/use-api-keys', () => ({
  useApiKeys: () => ({
    items: [KEY],
    isLoading: false,
    error: null,
    fetchApiKeys: async () => undefined,
    createApiKey: async () => undefined,
    updateApiKey: async () => undefined,
    regenerateApiKey: async () => undefined,
    setApiKeyEnabled: async () => undefined,
  }),
}));

import { ApiKeysTab } from './api-keys';

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

async function tab() {
  const mounted = mount(<ApiKeysTab />);
  await settle();
  return mounted.container;
}

describe('ApiKeysTab', () => {
  it('flag off: card rows, nothing of the grid', async () => {
    answerTableFlag('off');
    const container = await tab();

    expect(container.textContent).toContain('Billing export');
    expect(hasGridMarkup(container)).toBe(false);
  });

  it('flag on: the grid table, filling the page, with its gear and the row menu as an action column', async () => {
    answerTableFlag('on');
    const container = await tab();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['name', 'enabled', 'id', 'totalRequests', 'createdAt', 'expiresAt']);
    expect(gridViewport(container)).not.toBeNull();
    expect(gridSettingsGear(container)).not.toBeNull();
    expect(gridActions()).toEqual([['actions', 56]]);
    // The count is drawn once, above the table: the grid header does not draw the card header's right slot.
    expect((container.textContent ?? '').match(/1 API key/g)).toHaveLength(1);
    // One line a key: the description follows the name.
    expect(container.querySelector('[data-part="secondary"]')?.textContent).toBe(
      'Nightly export to the data warehouse',
    );
    expect(container.querySelector('button[aria-label="More actions"]')).not.toBeNull();
  });

  it('flag not answered: loading rows, no key drawn in either layout', async () => {
    answerTableFlag('loading');
    const container = await tab();

    expect(container.textContent).not.toContain('Billing export');
    expect(hasGridMarkup(container)).toBe(false);
  });

  it("keeps the card layout's columns", async () => {
    answerTableFlag('off');
    await tab();

    expect(cardMeta()).toEqual([
      ['name', 'flex-1 min-w-0', undefined, undefined],
      ['enabled', 'w-auto shrink-0 content-md:w-[120px]', undefined, undefined],
      ['id', 'w-[240px] shrink-0', 'xl', undefined],
      ['totalRequests', 'w-[100px] shrink-0', 'lg', undefined],
      ['createdAt', 'w-[140px] shrink-0', 'lg', undefined],
      ['expiresAt', 'w-[140px] shrink-0', 'md', undefined],
      ['actions', 'w-12 shrink-0 flex-none', undefined, 'right'],
    ]);
  });
});
