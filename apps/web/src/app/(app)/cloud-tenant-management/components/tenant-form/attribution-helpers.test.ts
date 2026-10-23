// Pins how a connection's customers become the attribution form and back: one customer holding
// a single ALL rule is "One customer owns this tenant", an archived or deleted customer stays in
// the form with its badge, a value belongs to one rule, only a real change sends `customers`, and
// every refusal the form draws lands on its own field.

import { describe, expect, it } from 'vitest';
import { DirectoryRuleKind } from '@/generated/schema-enums';
import {
  attributionChanged,
  attributionFieldPath,
  attributionToInput,
  CONNECTION_MODIFIED_CONCURRENTLY,
  readAttribution,
  type StoredCustomer,
  userErrorsDescription,
  valuesClaimedElsewhere,
} from './attribution-helpers';
import { ATTRIBUTION_MODE, type AttributionFormData } from './attribution.types';

function customer(
  organizationId: string,
  rules: StoredCustomer['rules'],
  status: string | null = 'ACTIVE',
): StoredCustomer {
  return {
    organizationId,
    organization: { organizationId, name: `Org ${organizationId}`, image: null, status },
    rules,
  };
}

const ALL_RULE = { kind: DirectoryRuleKind.ALL, values: [] };
const DOMAIN_RULE = { kind: DirectoryRuleKind.DOMAIN, values: [{ id: 'acme.com', name: 'acme.com' }] };
const GROUP_RULE = {
  kind: DirectoryRuleKind.GROUP,
  values: [
    { id: 'g-1', name: 'Clinicians' },
    { id: 'g-gone', name: null },
  ],
};

const LAB_GROUP = { kind: DirectoryRuleKind.GROUP, values: [{ id: 'g-1', name: 'Clinicians' }] };

const SHARED: AttributionFormData = {
  mode: ATTRIBUTION_MODE.SHARED,
  soleCustomerId: '',
  customers: [
    { organizationId: 'acme', rules: [DOMAIN_RULE] },
    { organizationId: 'lab', rules: [LAB_GROUP] },
  ],
};

/** `SHARED` with the lab's one rule replaced. */
function withLabRule(rule: AttributionFormData['customers'][number]['rules'][number]): AttributionFormData {
  return {
    ...SHARED,
    customers: [
      { organizationId: 'acme', rules: [DOMAIN_RULE] },
      { organizationId: 'lab', rules: [rule] },
    ],
  };
}

describe('readAttribution', () => {
  it('starts a connection with no customer on the first radio, nothing picked', () => {
    expect(readAttribution([]).values).toEqual({ mode: ATTRIBUTION_MODE.SOLE, soleCustomerId: '', customers: [] });
  });

  it('reads one customer holding a single ALL rule as the customer that owns the tenant', () => {
    expect(readAttribution([customer('acme', [ALL_RULE])]).values).toEqual({
      mode: ATTRIBUTION_MODE.SOLE,
      soleCustomerId: 'acme',
      customers: [],
    });
  });

  it('reads one customer narrowed by a rule, or several customers, as a shared directory', () => {
    expect(readAttribution([customer('acme', [DOMAIN_RULE])]).values.mode).toBe(ATTRIBUTION_MODE.SHARED);
    expect(readAttribution([customer('acme', [DOMAIN_RULE]), customer('lab', [GROUP_RULE])]).values).toEqual({
      mode: ATTRIBUTION_MODE.SHARED,
      soleCustomerId: '',
      customers: [
        { organizationId: 'acme', rules: [DOMAIN_RULE] },
        { organizationId: 'lab', rules: [GROUP_RULE] },
      ],
    });
  });

  it('keeps an ALL rule beside other customers as a rule, so saving the form unchanged sends it back', () => {
    const { values } = readAttribution([customer('acme', [ALL_RULE]), customer('lab', [GROUP_RULE])]);
    expect(values.customers[0]?.rules).toEqual([ALL_RULE]);
  });

  it('keeps archived and deleted customers in the form with a badge; a legacy one with no status is active', () => {
    const { values, options } = readAttribution([
      customer('acme', [DOMAIN_RULE], null),
      customer('old', [GROUP_RULE], 'ARCHIVED'),
      { organizationId: 'gone', organization: null, rules: [LAB_GROUP] },
    ]);
    expect(values.customers.map(stored => stored.organizationId)).toEqual(['acme', 'old', 'gone']);
    expect(options.get('acme')).toEqual({ organizationId: 'acme', name: 'Org acme', image: null });
    expect(options.get('old')).toEqual({ organizationId: 'old', name: 'Org old', image: null, badge: 'Archived' });
    expect(options.get('gone')).toEqual({
      organizationId: 'gone',
      name: 'Unknown customer',
      image: null,
      badge: 'Deleted',
    });
  });

  it('reads an archived customer holding a single ALL rule as the one that owns the tenant', () => {
    expect(readAttribution([customer('old', [ALL_RULE], 'ARCHIVED')]).values.soleCustomerId).toBe('old');
  });

  it('sends an archived customer back with the rest: it stays bound', () => {
    const { values } = readAttribution([customer('acme', [DOMAIN_RULE]), customer('old', [GROUP_RULE], 'ARCHIVED')]);
    expect(attributionToInput(values).map(sent => sent.organizationId)).toEqual(['acme', 'old']);
  });

  it('reads a rule kind this build does not know as not picked', () => {
    const future = { kind: 'TITLE' as DirectoryRuleKind, values: [] };
    expect(
      readAttribution([customer('acme', [future]), customer('lab', [GROUP_RULE])]).values.customers[0]?.rules,
    ).toEqual([{ kind: '', values: [] }]);
  });
});

describe('valuesClaimedElsewhere', () => {
  const NURSES = { kind: DirectoryRuleKind.GROUP, values: [{ id: 'g-2', name: 'Nurses' }] };
  const customers = [
    { organizationId: 'acme', rules: [DOMAIN_RULE, LAB_GROUP] },
    { organizationId: 'lab', rules: [NURSES] },
  ];

  it("lists the other rules' values of the same kind, never the rule's own", () => {
    expect([...valuesClaimedElsewhere(customers, 0, 1, DirectoryRuleKind.GROUP)]).toEqual(['g-2']);
    expect([...valuesClaimedElsewhere(customers, 1, 0, DirectoryRuleKind.GROUP)]).toEqual(['g-1']);
    expect([...valuesClaimedElsewhere(customers, 1, 0, DirectoryRuleKind.DOMAIN)]).toEqual(['acme.com']);
  });
});

describe('attributionToInput', () => {
  it('sends the owning customer as one ALL rule with no values', () => {
    expect(
      attributionToInput({ mode: ATTRIBUTION_MODE.SOLE, soleCustomerId: 'acme', customers: SHARED.customers }),
    ).toEqual([{ organizationId: 'acme', rules: [{ kind: DirectoryRuleKind.ALL }] }]);
  });

  it("sends each shared customer's rules by value id, an ALL rule without values", () => {
    expect(
      attributionToInput({
        ...SHARED,
        customers: [
          ...SHARED.customers,
          { organizationId: 'all', rules: [{ kind: DirectoryRuleKind.ALL, values: [] }] },
        ],
      }),
    ).toEqual([
      { organizationId: 'acme', rules: [{ kind: DirectoryRuleKind.DOMAIN, values: ['acme.com'] }] },
      { organizationId: 'lab', rules: [{ kind: DirectoryRuleKind.GROUP, values: ['g-1'] }] },
      { organizationId: 'all', rules: [{ kind: DirectoryRuleKind.ALL }] },
    ]);
  });
});

describe('attributionChanged', () => {
  it('is no change when only the hidden mode was touched, or a display name differs', () => {
    expect(attributionChanged({ ...SHARED, soleCustomerId: 'acme' }, SHARED)).toBe(false);
    expect(attributionChanged(withLabRule({ ...LAB_GROUP, values: [{ id: 'g-1', name: 'Doctors' }] }), SHARED)).toBe(
      false,
    );
  });

  it('is a change when a value, a rule, a customer or the mode is', () => {
    const added = withLabRule({ ...LAB_GROUP, values: [...LAB_GROUP.values, { id: 'g-2', name: 'Front desk' }] });
    expect(attributionChanged(added, SHARED)).toBe(true);
    expect(attributionChanged({ ...SHARED, customers: SHARED.customers.slice(1) }, SHARED)).toBe(true);
    expect(attributionChanged({ ...SHARED, mode: ATTRIBUTION_MODE.SOLE, soleCustomerId: 'acme' }, SHARED)).toBe(true);
  });
});

describe('attributionFieldPath', () => {
  it("puts a shared customer's refusals on its picker, its rule's kind and values", () => {
    const shared = ATTRIBUTION_MODE.SHARED;
    expect(attributionFieldPath('customers[1].organizationId', shared)).toBe('customers.1.organizationId');
    expect(attributionFieldPath('customers[0].rules[2].kind', shared)).toBe('customers.0.rules.2.kind');
    expect(attributionFieldPath('customers[0].rules[2].values', shared)).toBe('customers.0.rules.2.values');
    expect(attributionFieldPath('customers[0].rules[2].values[3]', shared)).toBe('customers.0.rules.2.values');
  });

  it('puts the owning customer on "Select Customer"', () => {
    expect(attributionFieldPath('customers[0].organizationId', ATTRIBUTION_MODE.SOLE)).toBe('soleCustomerId');
  });

  it('places nothing the form does not draw', () => {
    expect(attributionFieldPath('customers[0].rules', ATTRIBUTION_MODE.SHARED)).toBeNull();
    expect(attributionFieldPath('customers[0].rules[0].values', ATTRIBUTION_MODE.SOLE)).toBeNull();
    expect(attributionFieldPath('name', ATTRIBUTION_MODE.SHARED)).toBeNull();
    expect(attributionFieldPath(null, ATTRIBUTION_MODE.SHARED)).toBeNull();
  });
});

describe('userErrorsDescription', () => {
  it('says what to do about a save that crossed another one', () => {
    expect(userErrorsDescription([{ code: CONNECTION_MODIFIED_CONCURRENTLY, message: 'Connection modified' }])).toMatch(
      /Reload the page/,
    );
  });

  it("lists the API's messages once each", () => {
    expect(
      userErrorsDescription([
        { code: 'RULE_VALUE_UNKNOWN', message: 'Unknown GROUP id: g-gone' },
        { code: 'RULE_VALUE_UNKNOWN', message: 'Unknown GROUP id: g-gone' },
        { code: 'CUSTOMER_NOT_FOUND', message: 'Organization not found or not active: old' },
      ]),
    ).toBe('Unknown GROUP id: g-gone, Organization not found or not active: old');
  });
});
