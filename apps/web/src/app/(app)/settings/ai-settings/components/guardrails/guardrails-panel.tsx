'use client';

import { LoadError, NoData } from '@flamingo-stack/openframe-frontend-core';
import { InfoCircleIcon, ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { EmptyState } from '@/app/components/shared/empty-state';
import { GuardrailsPolicyGroups } from './guardrails-policy-groups';
import { GuardrailsPresetCard } from './guardrails-preset-card';
import { GuardrailsTemplatePicker } from './guardrails-template-picker';
import type { GuardrailsEditor } from './use-guardrails-editor';

interface GuardrailsPanelProps {
  editor: GuardrailsEditor;
  isEditMode: boolean;
}

/**
 * Tenant-level guardrails panel: read-only preset summary or the edit-mode
 * template picker, plus the grouped policy rules. Hosted by the AI Settings
 * guardrails tab. The customer details page composes the same building blocks
 * (GuardrailsPresetCard, GuardrailsPolicyGroups) over the per-organization
 * GraphQL data instead — see `customer-guardrails-tab.tsx`.
 */
export function GuardrailsPanel({ editor, isEditMode }: GuardrailsPanelProps) {
  // While the templates load (or in a page's loading scope), the panel draws itself in a loading scope: every part its
  // own skeleton. An error or an empty catalog is said only once the read has answered.
  const loading = useLoadingScope() || editor.isLoading;

  if (!loading && editor.loadError) {
    return (
      <LoadError
        message="Couldn't load guardrails policies. The service may be temporarily unavailable."
        onRetry={() => void editor.refetch()}
      />
    );
  }

  if (!loading && !editor.hasTemplates) {
    return (
      <EmptyState
        icon={<ShieldCheckIcon />}
        title="No policy templates available"
        description="Guardrails policy templates will appear here once the AI service provides them."
      />
    );
  }

  const rulesLoading = loading || editor.isDetailLoading;

  return (
    <LoadingWhen loading={loading} label="Loading guardrails" className="flex flex-col gap-[var(--spacing-system-l)]">
      {/* Figma 4365-22633: 16px padding and gap (12 on a phone), a bold title 4px over its line, a 24px icon (16). */}
      <div className="flex items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        <InfoCircleIcon className="size-4 shrink-0 text-ods-text-secondary content-md:size-6" />
        <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-ods-text-primary text-h3">Default settings for all customers</p>
          <p className="text-ods-text-secondary text-h6">
            Individual customers can be customized separately in their settings.
          </p>
        </div>
      </div>

      {/* Edit Settings swaps the preset card for the picker: the one that comes in fades in, as panels do across the
          system (keyed, so the swap re-runs it). */}
      {isEditMode ? (
        <div key="picker" className="duration-300 animate-in fade-in motion-reduce:animate-none">
          <GuardrailsTemplatePicker
            options={editor.templateOptions}
            value={editor.selectedTemplateId}
            onSelect={editor.selectTemplate}
            onCreateCustomPolicyFrom={editor.createCustomPolicyFrom}
          />
        </div>
      ) : (
        <div key="preset" className="duration-300 animate-in fade-in motion-reduce:animate-none">
          <GuardrailsPresetCard label={editor.activePresetLabel} />
        </div>
      )}

      {/* The rules load on their own (a template change re-reads them): one scope, always mounted, in which the
            groups draw their own skeleton; "no rules" is said only once they have answered. */}
      <LoadingWhen loading={rulesLoading}>
        {!rulesLoading && editor.policyGroups.size === 0 ? (
          <NoData
            icon={<ShieldCheckIcon />}
            title="This policy template has no rules"
            className="py-[var(--spacing-system-xxl)]"
          />
        ) : (
          <GuardrailsPolicyGroups
            switching={editor.isTemplateSwitching}
            groups={editor.policyGroups}
            editMode={editor.canEditRules}
            onPolicyPermissionChange={editor.setPolicyPermission}
            onCategoryPermissionChange={editor.applyCategoryPermission}
          />
        )}
      </LoadingWhen>
    </LoadingWhen>
  );
}
