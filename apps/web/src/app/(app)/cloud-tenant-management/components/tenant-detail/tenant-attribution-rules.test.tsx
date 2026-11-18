/**
 * An ALL rule is the "One customer owns this tenant" mode, not a rule: the table never lists it, and a tenant whose
 * customers hold nothing else has no Attribution Rules section at all. A tenant with no customers keeps the section
 * and its "No customers yet" prompt.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
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
  });

  it('keeps the section and its prompt for a tenant with no customers', async () => {
    await renderRules([]);

    expect(heading()).toBeDefined();
    expect(container.textContent).toContain('No customers yet');
  });
});
