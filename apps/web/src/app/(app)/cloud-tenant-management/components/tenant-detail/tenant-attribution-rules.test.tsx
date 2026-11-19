/**
 * An ALL rule is the "One customer owns this tenant" mode, not a rule: the table never lists it, and a tenant whose
 * customers hold nothing else has no Attribution Rules section at all. A tenant with no customers keeps the section
 * and its "No customers yet" prompt.
 *
 * The table follows the app's one table flag: card rows where it is off (the cases above), the grid table where it is
 * on, a loading table until it is answered.
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
import { DirectoryRuleKind } from '@/generated/schema-enums';

// Vitest runs no Relay Babel transform, so a `graphql` tag would throw at module scope. The section's tags (its query,
// its fragment and the `@inline` ones it reads through) resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const artifacts: Record<string, unknown> = {
    tenantAttributionRulesQuery: (await import('@/__generated__/tenantAttributionRulesQuery.graphql')).default,
    tenantAttributionRules_connection: (await import('@/__generated__/tenantAttributionRules_connection.graphql'))
      .default,
    boundCustomer_customer: (await import('@/__generated__/boundCustomer_customer.graphql')).default,
    customerOption_organization: (await import('@/__generated__/customerOption_organization.graphql')).default,
  };
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return {
    // CommonJS: the provider is only on `default`.
    ...actual.default,
    ...actual,
    graphql: (strings: TemplateStringsArray) => {
      const name = /(?:fragment|query|mutation)\s+(\w+)/.exec(strings.join(''))?.[1] ?? '';
      return artifacts[name] ?? {};
    },
  };
});

import { TenantAttributionRules } from './tenant-attribution-rules';

interface Rule {
  kind: DirectoryRuleKind;
  values: { id: string; lastKnownName: string; deleted: boolean }[];
  userCount: number;
}

const ALL_RULE: Rule = { kind: DirectoryRuleKind.ALL, values: [], userCount: 58 };
const GROUP_RULE: Rule = {
  kind: DirectoryRuleKind.GROUP,
  values: [{ id: 'g-1', lastKnownName: 'Sales', deleted: false }],
  userCount: 37,
};

function customer(name: string, rules: Rule[]) {
  return {
    organizationId: `org-${name}`,
    organization: {
      __typename: 'Organization',
      id: `node-${name}`,
      organizationId: `org-${name}`,
      name,
      status: 'ACTIVE',
      image: null,
    },
    rules,
  };
}

let container: HTMLDivElement;
let root: Root;

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};
const heading = () => [...container.querySelectorAll('h2')].find(node => node.textContent === 'Attribution Rules');

async function renderRules(customers: ReturnType<typeof customer>[]) {
  const environment = new Environment({
    network: Network.create(async () => ({ data: { directoryConnection: { id: 'c-1', customers } } })),
    store: new Store(new RecordSource()),
  });
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <TenantAttributionRules id="c-1" />
      </RelayEnvironmentProvider>,
    );
  });
  await settle();
}

describe('TenantAttributionRules', () => {
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
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // Card rows unless a case says otherwise: the flag answered, off.
    answerTableFlag('off');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    answerTableFlag('loading');
    window.localStorage.clear();
  });

  it('draws no section for a tenant whose only rule is ALL', async () => {
    await renderRules([customer('Acme', [ALL_RULE])]);

    expect(heading()).toBeUndefined();
    expect(container.textContent).not.toContain('Acme');
  });

  it('lists the other rules and leaves the ALL one out', async () => {
    await renderRules([customer('Acme', [GROUP_RULE, ALL_RULE])]);

    expect(heading()).toBeDefined();
    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('37');
    expect(container.textContent).not.toContain('58');
    // The flag is off: card rows, nothing of the grid.
    expect(hasGridMarkup(container)).toBe(false);
  });

  it('keeps the section and its prompt for a tenant with no customers', async () => {
    await renderRules([]);

    expect(heading()).toBeDefined();
    expect(container.textContent).toContain('No customers yet');
  });

  it('flag on: the grid table with its gear, at its natural height, the same rules in it', async () => {
    answerTableFlag('on');
    await renderRules([customer('Acme', [GROUP_RULE, ALL_RULE])]);

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['customer', 'matchBy', 'values', 'users']);
    expect(gridSettingsGear(container)).not.toBeNull();
    // The count is drawn once, above the table: the grid header does not draw the card header's right slot.
    expect((container.textContent ?? '').match(/1 result/g)).toHaveLength(1);
    // A section of a longer page: the page scrolls, the table has no viewport of its own.
    expect(gridViewport(container)).toBeNull();
    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('37');
    expect(container.textContent).not.toContain('58');
    // The phone's filter button belongs to the card rows: the grid header carries the funnels at every width.
    expect(container.querySelector('[aria-label="Filter attribution rules"]')).toBeNull();
  });

  it('flag on: a tenant whose only rule is ALL still has no section', async () => {
    answerTableFlag('on');
    await renderRules([customer('Acme', [ALL_RULE])]);

    expect(heading()).toBeUndefined();
  });

  it('flag not answered: the section with a loading table, no rule drawn in either layout', async () => {
    answerTableFlag('loading');
    await renderRules([customer('Acme', [GROUP_RULE])]);

    expect(heading()).toBeDefined();
    expect(container.textContent).not.toContain('Acme');
    expect(hasGridMarkup(container)).toBe(false);
  });
});
