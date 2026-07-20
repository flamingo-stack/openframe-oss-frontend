'use client';

import { EntityImage, LoadError, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { AiSettingsOverview } from '@/app/(app)/settings/ai-settings/components/ai-settings-overview';
import { AiSettingsPreviews } from '@/app/(app)/settings/ai-settings/components/previews/ai-settings-previews';
import { useClientView } from '@/app/(app)/settings/ai-settings/hooks/use-client-view';
import { useOrganizationClientAiConfig } from '@/app/(app)/settings/ai-settings/hooks/use-organization-ai-config';
import { getProviderModelLabel, useSupportedModels } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import {
  type AgentAiConfig,
  getDefaultAgentAiConfig,
  getDefaultClientView,
} from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { APPLICATION_THEME_LABEL } from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import { InfoCell } from '@/app/components/shared/info-cell';
import { featureFlags } from '@/lib/feature-flags';
import { getFullImageUrl } from '@/lib/image-url';

interface CustomerCustomAiAssistantTabProps {
  organizationId: string;
}

/**
 * Read-only "Customer AI Configuration" tab on the customer details page.
 * `customer-ai-configuration` switches the presentation: off (default) → the
 * legacy appearance-only view (pre-session); on → the full overview that
 * mirrors the global AI settings CLIENT tab. Editing happens on /customers/edit.
 */
export function CustomerCustomAiAssistantTab({ organizationId }: CustomerCustomAiAssistantTabProps) {
  return featureFlags.customerAiConfiguration.enabled() ? (
    <CustomerAiConfigurationReadOnly organizationId={organizationId} />
  ) : (
    <CustomerAiAppearanceReadOnly organizationId={organizationId} />
  );
}

/**
 * New flow: the full AiSettingsOverview (customer card + previews + quick
 * actions), fed with the customer's EFFECTIVE values — the org overrides where
 * present, the tenant defaults otherwise.
 */
function CustomerAiConfigurationReadOnly({ organizationId }: CustomerCustomAiAssistantTabProps) {
  const { view: orgView, isLoading: isViewLoading } = useClientView(organizationId);
  const { view: defaultView } = useClientView(null);
  const {
    config: orgConfig,
    isLoading: isConfigLoading,
    error: configError,
    refetch: refetchConfig,
  } = useOrganizationClientAiConfig(organizationId);
  const { modelsByProvider } = useSupportedModels();

  if (isViewLoading || isConfigLoading) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (configError) {
    return (
      <LoadError
        message="Couldn't load the customer AI configuration. The service may be temporarily unavailable."
        onRetry={() => void refetchConfig()}
      />
    );
  }

  const effectiveView = orgView ?? defaultView ?? getDefaultClientView(organizationId);
  // AiSettingsOverview consumes the tenant-level AgentAiConfig shape; project
  // the effective org values onto it (nullable fields fall back like the
  // global screen's defaults).
  const aiConfig: AgentAiConfig = {
    ...getDefaultAgentAiConfig('CLIENT'),
    llmProvider: orgConfig?.llmProvider ?? 'ANTHROPIC',
    providerModel: orgConfig?.providerModel ?? '',
    answerStyle: orgConfig?.answerStyle ?? null,
    customPrompt: orgConfig?.customPrompt ?? null,
    quickActions: orgConfig?.quickActions ?? [],
  };

  return (
    <AiSettingsOverview
      aiConfig={aiConfig}
      view={effectiveView}
      providerModelLabel={getProviderModelLabel(modelsByProvider, aiConfig.llmProvider, aiConfig.providerModel)}
      quickActions={aiConfig.quickActions}
    />
  );
}

const CELL = 'flex items-center gap-2 min-h-14 md:min-h-20 px-3 md:px-4 py-3 md:py-4';

/**
 * Legacy flow: read-only view of the customer's custom AI-Assistant appearance
 * (org-scoped ClientView override) — assistant name, avatar, theme, accent.
 */
function CustomerAiAppearanceReadOnly({ organizationId }: CustomerCustomAiAssistantTabProps) {
  // Shares the react-query cache with the parent's visibility check.
  const { view, isLoading } = useClientView(organizationId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  // The tab is only mounted when an override exists, but guard defensively.
  if (!view) {
    return null;
  }

  const avatarUrl = getFullImageUrl(view.assistantAvatar?.imageUrl, view.assistantAvatar?.hash);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="rounded-md border border-ods-border bg-ods-card">
        <div className={cn(CELL, 'border-b border-ods-border')}>
          {/* EntityImage defaults to size-[52px] md:size-[60px]; override both
              breakpoints so the avatar stays 40×40. */}
          <EntityImage src={avatarUrl} alt={view.assistantName} className="size-10 md:size-10 rounded-full" />
          <InfoCell value={view.assistantName} label="Custom Assistant Name" />
        </div>

        <div className="grid grid-cols-2">
          <div className={CELL}>
            <InfoCell value={APPLICATION_THEME_LABEL[view.applicationTheme]} label="Custom Application Theme" />
          </div>
          <div className={CELL}>
            <InfoCell value={view.accentColor?.toUpperCase()} label="Custom Accent Color" />
          </div>
        </div>
      </div>

      <AiSettingsPreviews
        assistantName={view.assistantName}
        avatarUrl={avatarUrl}
        accentColor={view.accentColor}
        theme={view.applicationTheme}
      />
    </div>
  );
}
