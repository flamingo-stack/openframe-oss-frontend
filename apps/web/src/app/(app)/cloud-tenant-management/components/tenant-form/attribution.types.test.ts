// Pins what the attribution form refuses before anything is sent: the mode on screen is the only
// one checked, and a rule needs a kind, and values unless it is ALL.

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
          { organizationId: 'lab', rules: [{ kind: DirectoryRuleKind.ALL, values: [] }] },
        ],
      }),
    ).toEqual(['customers.0.organizationId', 'customers.0.rules.0.kind', 'customers.0.rules.1.values']);
  });
});
