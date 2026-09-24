'use client';

import { InfoCircleIcon, PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, EntityImage, LoadError, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { AiSettingsOverview } from '@/app/(app)/settings/ai-settings/components/ai-settings-overview';
import { ASSISTANT_QUICK_ACTIONS_CONFIG } from '@/app/(app)/settings/ai-settings/components/ai-settings-quick-actions';
import { AiSettingsPreviews } from '@/app/(app)/settings/ai-settings/components/previews/ai-settings-previews';
import { useClientView } from '@/app/(app)/settings/ai-settings/hooks/use-client-view';
import { useHubDefaultQuickActions } from '@/app/(app)/settings/ai-settings/hooks/use-hub-default-quick-actions';
import { useOrganizationClientAiConfig } from '@/app/(app)/settings/ai-settings/hooks/use-organization-ai-config';
import { getProviderModelLabel, useSupportedModels } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import {
  type AgentAiConfig,
  getDefaultAgentAiConfig,
  getDefaultClientView,
} from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { APPLICATION_THEME_LABEL } from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useFeatureFlag, useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';

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
  // Tri-state: this flag picks which of two components the tab IS, so reading it
  // as a plain boolean rendered the legacy view — and ran its `useClientView`
  // query — for the length of the flags round-trip, then swapped the whole tab out
  // from under the user once the answer landed.
  const fullAiConfigGate = useFeatureFlagGate('customer-ai-configuration');

  if (fullAiConfigGate === 'loading') {
    return <CustomerAiTabSkeleton />;
  }

  return fullAiConfigGate === 'on' ? (
    <CustomerAiConfigurationReadOnly organizationId={organizationId} />
  ) : (
    <CustomerAiAppearanceReadOnly organizationId={organizationId} />
  );
}

/**
 * Stands in for whichever of the two views is coming. Deliberately the taller
 * (configuration) shape: both open with a card and a preview block, and the legacy
 * view is the shorter one, so this never leaves the tab shorter than what replaces it.
 */
function CustomerAiTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-40 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}

/**
 * New flow: the full AiSettingsOverview (customer card + previews + quick
 * actions), fed with the customer's EFFECTIVE values — the org overrides where
 * present, the tenant defaults otherwise. Always shown (like the guardrails
 * tab): when the customer inherits everything, a banner surfaces that and links
 * to the tenant defaults.
 */
function CustomerAiConfigurationReadOnly({ organizationId }: CustomerCustomAiAssistantTabProps) {
  const router = useRouter();
  const customizationEnabled = useFeatureFlag('customer-ai-assistant-settings');
  const { view: orgView, isLoading: isViewLoading } = useClientView(organizationId);
  const { view: defaultView } = useClientView(null);
  const {
    config: orgConfig,
    isLoading: isConfigLoading,
    error: configError,
    refetch: refetchConfig,
  } = useOrganizationClientAiConfig(organizationId);
  const { modelsByProvider } = useSupportedModels();
  // OpenFrame default quick actions from the Product Hub (the BE stores only
  // customs), shown when the customer inherits the default action set — same
  // source the settings CLIENT tab uses. Gated by the customization flag that
  // governs the quick-actions section inside AiSettingsOverview.
  const hubDefaults = useHubDefaultQuickActions(ASSISTANT_QUICK_ACTIONS_CONFIG.agentSlug, {
    enabled: customizationEnabled,
  });

  if (isViewLoading || isConfigLoading || hubDefaults.loading) {
    return <CustomerAiTabSkeleton />;
  }

  if (configError) {
    return (
      <LoadError
        message="Couldn't load the customer AI configuration. The service may be temporarily unavailable."
        onRetry={() => void refetchConfig()}
      />
    );
  }

  // Fully inheriting = no appearance override AND the AI logic inherits.
  const inheritsDefault = !orgView && (orgConfig?.inheritDefault ?? true);
  const effectiveView = orgView ?? defaultView ?? getDefaultClientView(organizationId);
  // orgConfig.quickActions is the live effective list: the customer's own set
  // when customized, else the tenant's current one; null → the built-in MPH set.
  const quickActions = orgConfig?.quickActions ?? hubDefaults.actions;
  const usesGlobalDefault = orgConfig?.quickActionsIsDefault ?? true;
  // Only when the effective list is OpenFrame's built-in set (inheriting AND
  // the tenant kept it) does the shared "OpenFrame …" header + "curated by
  // OpenFrame" banner apply.
  const isOpenFrameSet = usesGlobalDefault && !orgConfig?.quickActions;

  // AiSettingsOverview consumes the tenant-level AgentAiConfig shape; project
  // the effective org values onto it (nullable fields fall back like the
  // global screen's defaults).
  const aiConfig: AgentAiConfig = {
    ...getDefaultAgentAiConfig('CLIENT'),
    llmProvider: orgConfig?.llmProvider ?? 'ANTHROPIC',
    providerModel: orgConfig?.providerModel ?? '',
    answerStyle: orgConfig?.answerStyle ?? null,
    customPrompt: orgConfig?.customPrompt ?? null,
    quickActionsIsDefault: isOpenFrameSet,
    quickActions,
  };

  // Banner: OpenFrame set keeps the shared "curated by OpenFrame" copy; a list
  // matching the (customized) tenant default reads as inherited; anything else
  // is this customer's own set.
  const quickActionsBanner = isOpenFrameSet
    ? undefined
    : usesGlobalDefault
      ? { value: 'Using default quick actions', label: 'Inherited from your global AI-Assistant configuration.' }
      : { value: 'Using custom actions', label: 'These quick actions were configured for this customer.' };

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {inheritsDefault && (
        <div className="flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)] md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-s)]">
            <InfoCircleIcon className="size-6 shrink-0 text-ods-text-secondary" />
            <div className="flex min-w-0 flex-col">
              <p className="text-ods-text-primary text-h4">Using default AI-Assistant configuration</p>
              <p className="text-ods-text-secondary text-h6">
                Inherits all AI-Assistant settings from your global configuration.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(routes.settings.aiSettings({ tab: 'customer', edit: true }))}
            leftIcon={<PenEditIcon className="size-5 text-ods-text-secondary" />}
            className="shrink-0 self-start md:self-auto"
          >
            Edit Default Configuration
          </Button>
        </div>
      )}

      <AiSettingsOverview
        aiConfig={aiConfig}
        view={effectiveView}
        providerModelLabel={getProviderModelLabel(modelsByProvider, aiConfig.llmProvider, aiConfig.providerModel)}
        quickActions={quickActions}
        quickActionsBanner={quickActionsBanner}
      />
    </div>
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
          <EntityImage src={avatarUrl} alt={view.assistantName} className="size-10 rounded-full md:size-10" />
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
