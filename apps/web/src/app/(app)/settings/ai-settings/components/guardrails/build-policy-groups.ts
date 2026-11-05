import type { PermissionCategory } from '@flamingo-stack/openframe-frontend-core';
import { formatUnderscoreText, normalizeToolTypeWithFallback } from '@flamingo-stack/openframe-frontend-core/utils';
import { categoryIcon } from './category-icons';
import type { PolicyRule } from './guardrails.types';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Groups whose enum joins two subjects: the design writes them with "&" (Figma 555-40960, "Communication & Messaging"). */
const JOINED_GROUP_LABELS: Record<string, string> = {
  COMMUNICATION_MESSAGING_POLICY: 'Communication & Messaging Policy',
  MONITORING_DIAGNOSTICS_POLICY: 'Monitoring & Diagnostics Policy',
};

/** A policy group's enum (`FILE_OPERATIONS_POLICY`) as its section label is written. */
export function policyGroupLabel(policyGroup: string): string {
  return JOINED_GROUP_LABELS[policyGroup] ?? formatUnderscoreText(policyGroup);
}

/**
 * Groups flat policy rules into policy-group → categories → policies for the
 * core-lib PolicyConfigurationPanel, in the template's own order (the order the
 * design lists them in: Downloads, Uploads, Management). Pure data transform —
 * presentation state (expansion, bulk selections) is owned by the panel.
 */
export function buildPolicyGroups(rules: PolicyRule[]): Map<string, PermissionCategory[]> {
  const groupedByPolicyGroup = new Map<string, Map<string, PermissionCategory>>();

  for (const rule of rules) {
    const policyGroupName = rule.policyGroup || 'General';
    const categoryName = rule.category || 'Other';
    const categoryId = slugify(`${policyGroupName}:${categoryName}`) || 'other';

    let categoriesMap = groupedByPolicyGroup.get(policyGroupName);
    if (!categoriesMap) {
      categoriesMap = new Map();
      groupedByPolicyGroup.set(policyGroupName, categoriesMap);
    }

    let category = categoriesMap.get(categoryId);
    if (!category) {
      category = { id: categoryId, name: categoryName, icon: categoryIcon(categoryName), policies: [] };
      categoriesMap.set(categoryId, category);
    }

    category.policies.push({
      id: rule.naturalKey,
      naturalKey: rule.naturalKey,
      name: rule.operation || rule.naturalKey,
      commandPattern: rule.commandPattern,
      toolName: normalizeToolTypeWithFallback(rule.tool),
      approvalLevel: rule.approvalLevel,
    });
  }

  const finalGroups = new Map<string, PermissionCategory[]>();
  for (const [policyGroupName, categoriesMap] of groupedByPolicyGroup) {
    finalGroups.set(policyGroupName, Array.from(categoriesMap.values()));
  }

  return finalGroups;
}
