/**
 * The SSO providers table follows the app's one table flag: the grid table where it is on, card rows where it is off,
 * loading rows until it is answered. A handful of rows under the sign-in card: the grid keeps its natural height. The
 * edit button is its action column, and the card layout's columns are what they were.
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

// The hooks hand back the same functions on every render, as the real ones do (the tab reads on mount, keyed on them).
const sso = vi.hoisted(() => ({
  config: {
    fetchAvailableProviders: async () => [{ provider: 'google', displayName: 'Google Workspace' }],
    fetchProviderConfig: async (provider: string) =>
      provider === 'google'
        ? {
            enabled: true,
            clientId: 'client-id',
            clientSecret: null,
            allowedDomains: ['acme.io'],
            autoProvisionUsers: true,
          }
        : null,
    updateProviderConfig: async () => undefined,
    toggleProviderEnabled: async () => undefined,
    deleteProviderConfig: async () => undefined,
  },
  domain: {
    fetchTenantDomain: async () => null,
    updateSharedAutoProvision: async () => undefined,
    isLoading: false,
    isUpdating: false,
  },
}));

vi.mock('../../hooks/use-sso-config', () => ({ useSsoConfig: () => sso.config }));
vi.mock('../../hooks/use-tenant-domain', () => ({ useTenantDomain: () => sso.domain }));

import { SsoConfigurationTab } from './sso-configuration';

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
  const mounted = mount(<SsoConfigurationTab />);
  await settle();
  return mounted.container;
}
const editButton = (container: HTMLElement) => container.querySelector('button[aria-label="Edit Google Workspace"]');

describe('SsoConfigurationTab', () => {
  it('flag off: card rows, the edit button outlined', async () => {
    answerTableFlag('off');
    const container = await tab();

    expect(container.textContent).toContain('Google Workspace');
    expect(hasGridMarkup(container)).toBe(false);
    expect(editButton(container)?.className).not.toContain('border-0');
  });

  it('flag on: the grid table with its gear, at its natural height, the edit button in its action column', async () => {
    answerTableFlag('on');
    const container = await tab();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['provider', 'status', 'allowedDomains', 'hasConfig']);
    expect(gridSettingsGear(container)).not.toBeNull();
    // Under the sign-in card and the search: the page scrolls, the table has no viewport of its own.
    expect(gridViewport(container)).toBeNull();
    expect(gridActions()).toEqual([['actions', 56]]);
    expect(editButton(container)?.className).toContain('border-0');
    // One line a provider: its key follows its name.
    expect(container.querySelector('[data-part="secondary"]')?.textContent).toBe('google');
  });

  it('flag not answered: loading rows, no provider drawn in either layout', async () => {
    answerTableFlag('loading');
    const container = await tab();

    expect(editButton(container)).toBeNull();
    expect(hasGridMarkup(container)).toBe(false);
  });

  it("keeps the card layout's columns: the edit column keeps its own width", async () => {
    answerTableFlag('off');
    await tab();

    expect(cardMeta()).toEqual([
      ['provider', 'flex-1 min-w-0', undefined, undefined],
      ['status', 'w-auto shrink-0 content-md:w-[120px]', undefined, undefined],
      ['allowedDomains', 'w-[220px] shrink-0', 'md', undefined],
      ['hasConfig', 'w-[140px] shrink-0', 'lg', undefined],
      ['actions', 'w-11 shrink-0 content-md:w-16', undefined, 'right'],
    ]);
  });
});
