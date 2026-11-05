'use client';

import type { ApprovalLevel, PermissionCategory } from '@flamingo-stack/openframe-frontend-core';
import { PolicyConfigurationPanel } from '@flamingo-stack/openframe-frontend-core/components/features';
import { LoadingItems, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { noop, NO_ITEMS } from '@/app/components/shared';
import { policyGroupLabel } from './build-policy-groups';

interface GuardrailsPolicyGroupsProps {
  /** Unread while loading. */
  groups?: Map<string, PermissionCategory[]>;
  editMode?: boolean;
  onPolicyPermissionChange?: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
  onCategoryPermissionChange?: (categoryId: string, level: ApprovalLevel) => void;
  /** Another template's rules are on their way: these stay, dimmed and busy, until they land (no skeleton flash). */
  switching?: boolean;
}

const GROUPS_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-l)]';
const GROUP_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]';

/**
 * Groups the loading list draws. The groups are the template's, all of them at once (not paged), so there is no page
 * size: this is a template's typical count. Each group's panel draws its own skeleton categories.
 */
const GUARDRAILS_SKELETON_GROUPS = 2;
/** Categories a loading group draws: a template's groups hold three (File Downloads, Uploads, Management). */
const GUARDRAILS_SKELETON_CATEGORIES = 3;

interface PolicyGroupProps {
  /** The group's label; unread while loading. */
  name: string;
  categories: PermissionCategory[];
  editMode: boolean;
  onPolicyPermissionChange: NonNullable<GuardrailsPolicyGroupsProps['onPolicyPermissionChange']>;
  onCategoryPermissionChange: NonNullable<GuardrailsPolicyGroupsProps['onCategoryPermissionChange']>;
  loading: boolean;
}

/** One policy group, loaded and loading: its h5 label (a bar while loading) over its panel (the lib's own loading). */
function PolicyGroup({
  name,
  categories,
  editMode,
  onPolicyPermissionChange,
  onCategoryPermissionChange,
  loading,
}: PolicyGroupProps) {
  const isLoading = useLoadingScope() || loading;
  return (
    <div className={GROUP_CLASS} data-loading-item>
      {/* The group is the template's enum (`FILE_OPERATIONS_POLICY`): written as words. */}
      <TruncateText variant="h5" tone="secondary" loading={isLoading}>
        {policyGroupLabel(name)}
      </TruncateText>
      <PolicyConfigurationPanel
        categories={categories}
        editMode={editMode}
        onPolicyPermissionChange={onPolicyPermissionChange}
        onCategoryPermissionChange={onCategoryPermissionChange}
        loading={isLoading}
        skeletonCount={GUARDRAILS_SKELETON_CATEGORIES}
      />
    </div>
  );
}

/**
 * One PolicyConfigurationPanel per policy group, under an h5 section label. While the template's rules are on their
 * way (or in a loading scope) the same groups, `GUARDRAILS_SKELETON_GROUPS` of them, each drawing its own loading form.
 */
export function GuardrailsPolicyGroups({
  groups,
  editMode = false,
  onPolicyPermissionChange = noop,
  onCategoryPermissionChange = noop,
  switching = false,
}: GuardrailsPolicyGroupsProps) {
  const loading = useLoadingScope() || groups == null;
  return (
    <div
      aria-busy={switching || undefined}
      className={cn(GROUPS_CLASS, 'transition-opacity duration-200', switching && 'opacity-60')}
    >
      {loading ? (
        <LoadingItems count={GUARDRAILS_SKELETON_GROUPS}>
          {() => (
            <PolicyGroup
              name=""
              categories={NO_ITEMS}
              // The loaded rows' columns (the bulk dropdown while a custom policy is edited), locked.
              editMode={editMode}
              onPolicyPermissionChange={noop}
              onCategoryPermissionChange={noop}
              loading
            />
          )}
        </LoadingItems>
      ) : (
        Array.from(groups.entries(), ([policyGroupName, categories]) => (
          <PolicyGroup
            key={policyGroupName}
            name={policyGroupName}
            categories={categories}
            editMode={editMode}
            onPolicyPermissionChange={onPolicyPermissionChange}
            onCategoryPermissionChange={onCategoryPermissionChange}
            loading={false}
          />
        ))
      )}
    </div>
  );
}
