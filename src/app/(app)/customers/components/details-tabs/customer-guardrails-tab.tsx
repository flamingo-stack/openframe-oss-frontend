'use client';

import { LoadError, NoData, Skeleton } from '@flamingo-stack/openframe-frontend-core';
import {
  InfoCircleIcon,
  PenEditIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { buildPolicyGroups } from '@/app/(app)/settings/ai-settings/components/guardrails/build-policy-groups';
import { GuardrailsPolicyGroups } from '@/app/(app)/settings/ai-settings/components/guardrails/guardrails-policy-groups';
import { GuardrailsPresetCard } from '@/app/(app)/settings/ai-settings/components/guardrails/guardrails-preset-card';
import { useGuardrailsTemplates } from '@/app/(app)/settings/ai-settings/components/guardrails/use-guardrails-policies';
import { useOrganizationGuardrails } from '@/app/(app)/settings/ai-settings/components/guardrails/use-organization-guardrails';
import { routes } from '@/lib/routes';

interface CustomerGuardrailsTabProps {
  organizationId: string;
}

/**
 * "Customer AI Guardrails" tab on the customer details page. Reads the
 * organization's EFFECTIVE guardrails via `organizationGuardrails` — tenant
 * default rules while the org inherits (`inheritDefault`), the org's own
 * materialized policy otherwise. Read-only: tenant defaults are edited in
 * AI Settings → Guardrails; a per-customer edit flow can build on the
 * `updateOrganizationGuardrails` / `resetOrganizationGuardrails` mutations.
 */
export function CustomerGuardrailsTab({ organizationId }: CustomerGuardrailsTabProps) {
  const router = useRouter();
  const { guardrails, isLoading, error, refetch } = useOrganizationGuardrails(organizationId);
  // Tenant preset list (REST): resolves display names for the preset card.
  const { templates, activeTemplateId, isLoading: isTemplatesLoading } = useGuardrailsTemplates();

  const policyGroups = useMemo(() => buildPolicyGroups(guardrails?.rules ?? []), [guardrails]);

  if (isLoading || isTemplatesLoading) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-sf)]">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !guardrails) {
    return (
      <LoadError
        message="Couldn't load customer guardrails. The service may be temporarily unavailable."
        onRetry={() => void refetch()}
      />
    );
  }

  const inheritsDefault = guardrails.inheritDefault;
  const sourceTemplateLabel = templates.find(t => t.id === guardrails.sourceTemplate)?.displayName;
  // An org policy without overrides IS the source preset (materialized as-is
  // by the edit page's preset radio) — only overridden rules make it custom.
  const presetLabel = inheritsDefault
    ? templates.find(t => t.id === activeTemplateId)?.displayName || 'None'
    : guardrails.overrides.length === 0 && sourceTemplateLabel
      ? sourceTemplateLabel
      : `Custom Policy${sourceTemplateLabel ? ` (based on ${sourceTemplateLabel})` : ''}`;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {inheritsDefault && (
        <div className="flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)] md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-s)]">
            <InfoCircleIcon className="size-6 shrink-0 text-ods-text-secondary" />
            <div className="flex min-w-0 flex-col">
              <p className="text-ods-text-primary text-h4">Using Default Settings</p>
              <p className="text-ods-text-secondary text-h6">This customer follows guardrails defaults.</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(routes.settings.aiSettings({ tab: 'guardrails', edit: true }))}
            leftIcon={<PenEditIcon className="size-5 text-ods-text-secondary" />}
            className="shrink-0 self-start md:self-auto"
          >
            Edit Default Guardrails
          </Button>
        </div>
      )}

      <GuardrailsPresetCard label={presetLabel} muted={inheritsDefault} />

      {policyGroups.size === 0 ? (
        <NoData
          icon={<ShieldCheckIcon />}
          title="No guardrail rules configured"
          className="py-[var(--spacing-system-xxl)]"
        />
      ) : (
        <GuardrailsPolicyGroups groups={policyGroups} />
      )}
    </div>
  );
}
