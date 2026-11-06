import { describe, expect, it } from 'vitest';

import { buildPolicyGroups, policyGroupLabel } from './build-policy-groups';
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

  it("keeps the template's order of categories", () => {
    const names = (
      buildPolicyGroups([rule('File Downloads'), rule('File Uploads'), rule('File Management')]).get(
        'FILE_OPERATIONS_POLICY',
      ) ?? []
    ).map(category => category.name);
    expect(names).toEqual(['File Downloads', 'File Uploads', 'File Management']);
  });
});

describe('policyGroupLabel', () => {
  it('writes a group in words, joined subjects with "&"', () => {
    expect(policyGroupLabel('FILE_OPERATIONS_POLICY')).toBe('File Operations Policy');
    expect(policyGroupLabel('COMMUNICATION_MESSAGING_POLICY')).toBe('Communication & Messaging Policy');
  });
});
