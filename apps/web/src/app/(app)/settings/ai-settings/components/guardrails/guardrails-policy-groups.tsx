'use client';

import type { ApprovalLevel, PermissionCategory } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { PolicyConfigurationPanel } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { noop } from '@/app/components/shared';

interface GuardrailsPolicyGroupsProps {
  /** Unread while loading. */
  groups?: Map<string, PermissionCategory[]>;
  editMode?: boolean;
  onPolicyPermissionChange?: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
  onCategoryPermissionChange?: (categoryId: string, level: ApprovalLevel) => void;
}

const NO_CATEGORIES: PermissionCategory[] = [];

const GROUPS_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-l)]';
const GROUP_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]';

/**
 * Groups the loading list draws. The groups are the template's, all of them at once (not paged), so there is no page
 * size: this is a template's typical count. Each group's panel draws its own skeleton categories.
 */
const GUARDRAILS_SKELETON_GROUPS = 2;

/** The groups while the template's rules are on its way: each group's label a bar, its panel the lib's loading panel. */
function GuardrailsPolicyGroupsSkeleton() {
  return (
    <div className={GROUPS_CLASS}>
      {Array.from({ length: GUARDRAILS_SKELETON_GROUPS }, (_, group) => (
        <div key={group} className={GROUP_CLASS} data-loading-item>
          <TextLineSkeleton type="h5" className="w-32" />
          <PolicyConfigurationPanel
            categories={NO_CATEGORIES}
            editMode={false}
            onPolicyPermissionChange={noop}
            onCategoryPermissionChange={noop}
            loading
          />
        </div>
      ))}
    </div>
  );
}

/** One PolicyConfigurationPanel per policy group, under an h5 section label. In a loading scope, its skeleton. */
export function GuardrailsPolicyGroups({
  groups,
  editMode = false,
  onPolicyPermissionChange = noop,
  onCategoryPermissionChange = noop,
}: GuardrailsPolicyGroupsProps) {
  if (useLoadingScope() || groups == null) return <GuardrailsPolicyGroupsSkeleton />;
  return (
    <div className={GROUPS_CLASS}>
      {Array.from(groups.entries()).map(([policyGroupName, categories]) => (
        <div key={policyGroupName} className={GROUP_CLASS} data-loading-item>
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
