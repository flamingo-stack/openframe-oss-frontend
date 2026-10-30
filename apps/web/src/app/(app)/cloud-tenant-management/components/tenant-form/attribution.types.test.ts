// Pins what the attribution form refuses before anything is sent: the mode on screen is the only
// one checked, a rule needs a kind, and values unless it is ALL; ALL is a single customer's, and a
// value belongs to one rule per connection.

import { describe, expect, it } from 'vitest';
import { DirectoryRuleKind } from '@/generated/schema-enums';
import { ATTRIBUTION_DEFAULT_VALUES, ATTRIBUTION_MODE, attributionFormSchema, newRule } from './attribution.types';

function issuePaths(input: unknown): string[] {
  const result = attributionFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map(issue => issue.path.join('.')).sort();
}

describe('attributionFormSchema', () => {
  it('asks for the owning customer on the pristine form', () => {
    expect(issuePaths(ATTRIBUTION_DEFAULT_VALUES)).toEqual(['soleCustomerId']);
  });

  it('ignores the shared customers while one customer owns the tenant', () => {
    expect(
      issuePaths({
        mode: ATTRIBUTION_MODE.SOLE,
        soleCustomerId: 'acme',
        customers: [{ organizationId: '', rules: [newRule()] }],
      }),
    ).toEqual([]);
  });

  it('asks a shared customer for its customer, each rule for its kind and its values', () => {
    expect(
      issuePaths({
        mode: ATTRIBUTION_MODE.SHARED,
        soleCustomerId: '',
        customers: [
          { organizationId: '', rules: [newRule(), { kind: DirectoryRuleKind.GROUP, values: [] }] },
          {
            organizationId: 'lab',
            rules: [{ kind: DirectoryRuleKind.DOMAIN, values: [{ id: 'lab.org', name: null }] }],
          },
        ],
      }),
    ).toEqual(['customers.0.organizationId', 'customers.0.rules.0.kind', 'customers.0.rules.1.values']);
  });

  it('keeps All accounts to a single customer', () => {
    const allRule = { kind: DirectoryRuleKind.ALL, values: [] };
    const group = { kind: DirectoryRuleKind.GROUP, values: [{ id: 'g-1', name: 'Clinicians' }] };
    expect(
      issuePaths({
        mode: ATTRIBUTION_MODE.SHARED,
        soleCustomerId: '',
        customers: [{ organizationId: 'acme', rules: [allRule, group] }],
      }),
    ).toEqual([]);
    expect(
      issuePaths({
        mode: ATTRIBUTION_MODE.SHARED,
        soleCustomerId: '',
        customers: [
          { organizationId: 'acme', rules: [allRule] },
          { organizationId: 'lab', rules: [group] },
        ],
      }),
    ).toEqual(['customers.0.rules.0.kind']);
  });

  it('asks the later rule to give up a value another rule already holds, across customers', () => {
    const result = attributionFormSchema.safeParse({
      mode: ATTRIBUTION_MODE.SHARED,
      soleCustomerId: '',
      customers: [
        {
          organizationId: 'acme',
          rules: [{ kind: DirectoryRuleKind.GROUP, values: [{ id: 'g-1', name: 'Clinicians' }] }],
        },
        {
          organizationId: 'lab',
          rules: [
            {
              kind: DirectoryRuleKind.GROUP,
              values: [
                { id: 'g-1', name: 'Clinicians' },
                { id: 'g-2', name: null },
              ],
            },
            // The same id under another kind is another value.
            { kind: DirectoryRuleKind.DOMAIN, values: [{ id: 'g-1', name: 'g-1' }] },
          ],
        },
      ],
    });
    expect(result.success ? [] : result.error.issues.map(issue => [issue.path.join('.'), issue.message])).toEqual([
      ['customers.1.rules.0.values', 'Clinicians is already in another rule'],
    ]);
  });
});
