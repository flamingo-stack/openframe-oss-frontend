'use client';

import type { ApprovalLevel, PermissionCategory } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { PolicyConfigurationPanel } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';

interface GuardrailsPolicyGroupsProps {
  /** Unread while loading. */
  groups?: Map<string, PermissionCategory[]>;
  editMode?: boolean;
  onPolicyPermissionChange?: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
  onCategoryPermissionChange?: (categoryId: string, level: ApprovalLevel) => void;
}

const noop = () => {};

const GROUPS_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-l)]';
const GROUP_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]';

/**
 * The loading list's size. The groups and their categories are the template's, all of them at once (not paged), so
 * there is no page size: these are a template's typical counts.
 */
const GUARDRAILS_SKELETON_GROUPS = 2;
const GUARDRAILS_SKELETON_CATEGORIES = 4;

/**
 * The groups while the template's rules are on its way: each group's label a bar, and its panel drawn as the lib's
 * `PolicyConfigurationPanel` draws a collapsed category row (that panel has no skeleton of its own): the icon tile,
 * the name and the configuration count, the chevron.
 */
export function GuardrailsPolicyGroupsSkeleton() {
  return (
    <div className={GROUPS_CLASS}>
      {Array.from({ length: GUARDRAILS_SKELETON_GROUPS }, (_, group) => (
        <div key={group} className={GROUP_CLASS} data-loading-item>
          <TextLineSkeleton type="h5" className="w-32" />
          <div className="overflow-hidden rounded-md border border-ods-border bg-ods-card">
            {Array.from({ length: GUARDRAILS_SKELETON_CATEGORIES }, (_cell, category) => (
              <div
                key={category}
                data-loading-item
                className="flex items-center gap-[var(--spacing-system-m)] border-t border-ods-border py-[var(--spacing-system-s)] pl-[var(--spacing-system-m)] pr-[var(--spacing-system-xsf)] first:border-t-0"
              >
                <UnifiedSkeleton className="h-8 w-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <TextLineSkeleton type="h4" className="w-1/2" />
                  <TextLineSkeleton type="h6" className="w-28" />
                </div>
                <UnifiedSkeleton className="size-6 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
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
