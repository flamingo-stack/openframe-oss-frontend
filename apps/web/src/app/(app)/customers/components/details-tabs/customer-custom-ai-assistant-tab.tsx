'use client';

import { InfoCircleIcon, PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, LoadError, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { AiSettingsOverview } from '@/app/(app)/settings/ai-settings/components/ai-settings-overview';
import { ASSISTANT_QUICK_ACTIONS_CONFIG } from '@/app/(app)/settings/ai-settings/components/ai-settings-quick-actions';
import { useClientView } from '@/app/(app)/settings/ai-settings/hooks/use-client-view';
import { useHubDefaultQuickActions } from '@/app/(app)/settings/ai-settings/hooks/use-hub-default-quick-actions';
import { useOrganizationClientAiConfig } from '@/app/(app)/settings/ai-settings/hooks/use-organization-ai-config';
import { getProviderModelLabel, useSupportedModels } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import {
  type AgentAiConfig,
  getDefaultAgentAiConfig,
  getDefaultClientView,
} from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { routes } from '@/lib/routes';

interface CustomerCustomAiAssistantTabProps {
  organizationId: string;
}

/**
 * Read-only "Customer AI Configuration" tab on the customer details page: the
 * full AiSettingsOverview (customer card + previews + quick actions), fed with
 * the customer's EFFECTIVE values — the org overrides where present, the tenant
 * defaults otherwise. Always shown (like the guardrails tab): when the customer
 * inherits everything, a banner surfaces that and links to the tenant defaults.
 * Editing happens on /customers/edit.
 */
export function CustomerCustomAiAssistantTab({ organizationId }: CustomerCustomAiAssistantTabProps) {
  const router = useRouter();
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
  // source the settings CLIENT tab uses.
  const hubDefaults = useHubDefaultQuickActions(ASSISTANT_QUICK_ACTIONS_CONFIG.agentSlug);

  // While the settings load the tab draws itself in a loading scope: the static banner for real (most customers
  // inherit the defaults), the overview's customer card, previews and quick actions each their own skeleton.
  const loading = isViewLoading || isConfigLoading || hubDefaults.loading;

  if (!loading && configError) {
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
    <LoadingWhen loading={loading}>
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        {inheritsDefault && (
          <div className="flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)] content-md:flex-row content-md:items-center">
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
              className="shrink-0 self-start content-md:self-auto"
            >
              Edit Default Configuration
            </Button>
          </div>
        )}

        {/* Loading: no values handed over (the overview's parts read nothing in the scope). */}
        <AiSettingsOverview
          aiConfig={loading ? undefined : aiConfig}
          view={loading ? undefined : effectiveView}
          providerModelLabel={
            loading ? undefined : getProviderModelLabel(modelsByProvider, aiConfig.llmProvider, aiConfig.providerModel)
          }
          quickActions={loading ? undefined : quickActions}
          quickActionsBanner={quickActionsBanner}
        />
      </div>
    </LoadingWhen>
  );
}
