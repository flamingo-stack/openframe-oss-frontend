import { describe, expect, it } from 'vitest';

import { buildPolicyGroups } from './build-policy-groups';
import type { PolicyRule } from './guardrails.types';

const rule = (category: string): PolicyRule => ({
  tool: 'OPENFRAME',
  function: 'runCommand',
  policyGroup: 'FILE_OPERATIONS_POLICY',
  category,
  operation: 'Download files from web',
  commandPattern: '.*',
  approvalLevel: 'ASK_USER',
  naturalKey: `${category}:web`,
});

describe('buildPolicyGroups', () => {
  it("gives a category the design's icon, and none to one it does not know", () => {
    const [known, unknown] =
      buildPolicyGroups([rule('File Downloads'), rule('Something New')]).get('FILE_OPERATIONS_POLICY') ?? [];
    expect([known?.name, unknown?.name].sort()).toEqual(['File Downloads', 'Something New']);
    const byName = new Map([known, unknown].map(category => [category?.name, category]));
    expect(byName.get('File Downloads')?.icon).toBeTruthy();
    expect(byName.get('Something New')?.icon).toBeUndefined();
  });
});
