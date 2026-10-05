'use client';

import type { ApprovalLevel, PermissionCategory } from '@flamingo-stack/openframe-frontend-core';
import { PolicyConfigurationPanel } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface GuardrailsPolicyGroupsProps {
  groups: Map<string, PermissionCategory[]>;
  editMode?: boolean;
  onPolicyPermissionChange?: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
  onCategoryPermissionChange?: (categoryId: string, level: ApprovalLevel) => void;
}

const noop = () => {};

/** One PolicyConfigurationPanel per policy group, under an h5 section label. */
export function GuardrailsPolicyGroups({
  groups,
  editMode = false,
  onPolicyPermissionChange = noop,
  onCategoryPermissionChange = noop,
}: GuardrailsPolicyGroupsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-l)]">
      {Array.from(groups.entries()).map(([policyGroupName, categories]) => (
        <div key={policyGroupName} className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
          <TruncateText variant="h5" tone="secondary">
            {policyGroupName}
          </TruncateText>
          <PolicyConfigurationPanel
            categories={categories}
            editMode={editMode}
            onPolicyPermissionChange={onPolicyPermissionChange}
            onCategoryPermissionChange={onCategoryPermissionChange}
          />
        </div>
      ))}
    </div>
  );
}
