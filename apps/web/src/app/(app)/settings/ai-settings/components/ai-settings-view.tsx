'use client';

import { LoadError, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { loadErrorProps } from '@/lib/query-state';
import {
  useAdminAiConfig,
  useClientAiConfig,
  useUpdateAdminAiConfig,
  useUpdateClientAiConfig,
} from '../hooks/use-agent-ai-config';
import {
  clientViewQueryKeys,
  useClientView,
  useUpdateClientView,
  withClientViewCreateFields,
} from '../hooks/use-client-view';
import type { CommitAvatar } from '../hooks/use-customer-ai-assistant-form';
import { useUpdateAiConfiguration } from '../hooks/use-update-ai-configuration';
import {
  type AgentAiConfig,
  type AgentAiConfigInput,
  getDefaultAgentAiConfig,
  getDefaultClientView,
} from '../types/ai-settings';
import type { CustomerAiAssistantSubmit } from '../types/customer-ai-assistant.types';
import { MINGO_AI_CHAT_FORM_ID } from '../types/mingo-ai-chat.types';
import { useAiSettingsActions } from './ai-settings-actions';
import { AiSettingsLayout } from './ai-settings-layout';
import { AI_SETTINGS_TABS, type AiSettingsTabId, AiSettingsTabs, useVisibleAiSettingsTabs } from './ai-settings-tabs';
import { CUSTOMER_AI_ASSISTANT_FORM_ID, CustomerAiAssistantTab } from './customer-ai-assistant-tab';
import { DEVICE_GUARDRAILS_FORM_ID, DeviceGuardrailsTab } from './device-guardrails/device-guardrails-tab';
import { GUARDRAILS_FORM_ID, GuardrailsTab } from './guardrails/guardrails-tab';
import { MingoAiChatTab } from './mingo-ai-chat-tab';

const FORM_ID_BY_TAB: Record<AiSettingsTabId, string> = {
  customer: CUSTOMER_AI_ASSISTANT_FORM_ID,
  mingo: MINGO_AI_CHAT_FORM_ID,
  guardrails: GUARDRAILS_FORM_ID,
  'device-guardrails': DEVICE_GUARDRAILS_FORM_ID,
};

/** The tabs no flag hides: the set the page draws until the flag that shapes it answers. */
const ALWAYS_VISIBLE_TABS = AI_SETTINGS_TABS.filter(tab => tab.id !== 'device-guardrails');

function isAiSettingsTabId(id: string | null): id is AiSettingsTabId {
  return AI_SETTINGS_TABS.some(tab => tab.id === id);
}

/**
 * The page waits for the flags that shape its tab set before showing a tab other than the two every set has: until
 * then it renders itself in its loading scope (the tab bar and the tab a link names, else `mingo`, each drawing its
 * own loading state) and no tab's query starts. The tab a link names is kept from the first render and
 * shown once the set is known, so `?tab=device-guardrails` lands on its tab even though the set starts without it.
 */
export function AiSettings() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const visibleTabs = useVisibleAiSettingsTabs();
  const tabsLoading = visibleTabs == null;
  const tabs = visibleTabs ?? ALWAYS_VISIBLE_TABS;

  // Tabs are feature-flag gated; default to the first one that's visible.
  const firstTabId = (tabs[0]?.id as AiSettingsTabId | undefined) ?? 'guardrails';

  // Deep-link support: `?tab=<id>&edit=true` opens a tab in edit mode
  // (e.g. "Edit Default Appearance" on the customer edit page).
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<AiSettingsTabId | null>(isAiSettingsTabId(tabParam) ? tabParam : null);
  const [isEditMode, setIsEditMode] = useState(searchParams.get('edit') === 'true');

  // Fall back to a visible tab if the active one is hidden by a flag (or not chosen).
  // While the set is read, the tab a link names is kept (it draws its own loading state), else `mingo`.
  const effectiveTab: AiSettingsTabId = tabsLoading
    ? (activeTab ?? 'mingo')
    : activeTab && tabs.some(tab => tab.id === activeTab)
      ? activeTab
      : firstTabId;
  const isCustomer = effectiveTab === 'customer';
  const isMingo = effectiveTab === 'mingo';

  // CLIENT screen needs the client AI config + client view; ADMIN needs the
  // admin AI config. Queries are gated by tab so only the active one fetches.
  // Nothing reads before the tab set is known.
  const clientAi = useClientAiConfig({ enabled: isCustomer && !tabsLoading });
  const clientView = useClientView(null, { enabled: isCustomer && !tabsLoading });
  const adminAi = useAdminAiConfig({ enabled: isMingo && !tabsLoading });

  const queryClient = useQueryClient();
  const { update: updateClientAiConfig } = useUpdateClientAiConfig();
  // The avatar is attached AFTER the save resolves (commitAvatar below) —
  // auto-invalidating here would refetch the pre-upload avatar and flicker
  // the preview, so invalidation happens once, after the avatar commit.
  const { update: updateClientView } = useUpdateClientView(null, { invalidateOnSuccess: false });
  const { update: updateAdminAiConfig } = useUpdateAdminAiConfig();
  const { updateAiConfiguration } = useUpdateAiConfiguration();

  // No record yet → start from defaults so the first save creates one.
  const clientAiConfig = clientAi.config ?? getDefaultAgentAiConfig('CLIENT');
  const view = clientView.view ?? getDefaultClientView();
  const adminAiConfig = adminAi.config ?? getDefaultAgentAiConfig('ADMIN');

  const customerLoading = (clientAi.isLoading && !clientAi.config) || (clientView.isLoading && !clientView.view);
  const customerError = (!clientAi.config && clientAi.error) || (!clientView.view && clientView.error);
  const mingoLoading = adminAi.isLoading && !adminAi.config;
  const mingoError = !adminAi.config && adminAi.error;
  // Offline is neither loading nor error: the query is PAUSED, so `isLoading` and
  // `error` are both false with no data. Without this branch the screen falls
  // through to `getDefaultAgentAiConfig`/`getDefaultClientView` below, renders an
  // editable form seeded from those defaults, and Save writes them over the
  // tenant's real settings — the exact overwrite the `hasLoadError` guard says it
  // prevents.
  const customerOffline = (!clientAi.config && clientAi.isOffline) || (!clientView.view && clientView.isOffline);
  const mingoOffline = !adminAi.config && adminAi.isOffline;

  const isLoading = tabsLoading || (isCustomer ? customerLoading : isMingo ? mingoLoading : false);
  const hasLoadError = isCustomer ? Boolean(customerError) : isMingo ? Boolean(mingoError) : false;
  const isOffline = isCustomer ? customerOffline : isMingo ? mingoOffline : false;

  const refetchActive = useCallback(() => {
    if (isCustomer) {
      clientAi.refetch();
      clientView.refetch();
    } else if (isMingo) {
      adminAi.refetch();
    }
  }, [isCustomer, isMingo, clientAi, clientView, adminAi]);

  const handleEdit = useCallback(() => setIsEditMode(true), []);

  // Switching tabs drops any in-progress edit back to the read-only view.
  const handleTabChange = useCallback((id: AiSettingsTabId) => {
    setActiveTab(id);
    setIsEditMode(false);
  }, []);

  const handleSave = useCallback(() => {
    const form = document.getElementById(FORM_ID_BY_TAB[effectiveTab]);
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, [effectiveTab]);

  // The active AI configuration (provider/model) is still mirrored to the chat
  // backend's REST endpoint, which owns the real LLM integration.
  const syncAiConfiguration = useCallback(
    (input: AgentAiConfigInput, current: AgentAiConfig) => {
      if (
        input.llmProvider &&
        input.providerModel &&
        (input.llmProvider !== current.llmProvider || input.providerModel !== current.providerModel)
      ) {
        updateAiConfiguration({ provider: input.llmProvider, modelName: input.providerModel });
      }
    },
    [updateAiConfiguration],
  );

  const handleCustomerSubmit = useCallback(
    (payload: CustomerAiAssistantSubmit, commitAvatar: CommitAvatar) => {
      // The CLIENT screen writes two collections; surface one combined toast.
      void (async () => {
        try {
          // allSettled, not all: the `finally` invalidation below must not run
          // while one save is still pending (a fast-failing sibling would let
          // the refetch race the in-flight write and cache the pre-save view).
          const [aiResult, viewResult] = await Promise.allSettled([
            updateClientAiConfig(payload.ai),
            updateClientView(withClientViewCreateFields(payload.view, !clientView.view)),
          ]);
          const failure = [aiResult, viewResult].find(result => result.status === 'rejected');
          if (failure) {
            const reason = (failure as PromiseRejectedResult).reason;
            throw reason instanceof Error ? reason : new Error(String(reason));
          }
          const savedView = viewResult.status === 'fulfilled' ? viewResult.value : null;
          syncAiConfiguration(payload.ai, clientAiConfig);

          // Attach the staged avatar to the SAVED view id — on a fresh tenant
          // the record only exists after the save above created it.
          try {
            const savedViewId = savedView?.id || clientView.view?.id;
            if (savedViewId) {
              await commitAvatar(savedViewId);
            }
          } catch (err) {
            toast({
              title: 'Avatar upload failed',
              description: err instanceof Error ? err.message : 'Settings saved, but the avatar was not updated',
              variant: 'destructive',
            });
          }

          toast({ title: 'Saved', description: 'AI assistant settings updated', variant: 'success' });
          setIsEditMode(false);
        } catch (err) {
          toast({
            title: 'Save failed',
            description: err instanceof Error ? err.message : 'Failed to save settings',
            variant: 'destructive',
          });
        } finally {
          // Tenant-default save: also drops per-org entries so customer pages
          // inheriting the default appearance refresh without a reload.
          queryClient.invalidateQueries({ queryKey: clientViewQueryKeys.all });
        }
      })();
    },
    [updateClientAiConfig, updateClientView, syncAiConfiguration, clientAiConfig, clientView.view, toast, queryClient],
  );

  const handleMingoSubmit = useCallback(
    (input: AgentAiConfigInput) => {
      void (async () => {
        try {
          await updateAdminAiConfig(input);
          syncAiConfiguration(input, adminAiConfig);
          toast({ title: 'Saved', description: 'Mingo AI settings updated', variant: 'success' });
          setIsEditMode(false);
        } catch (err) {
          toast({
            title: 'Save failed',
            description: err instanceof Error ? err.message : 'Failed to save settings',
            variant: 'destructive',
          });
        }
      })();
    },
    [updateAdminAiConfig, syncAiConfiguration, adminAiConfig, toast],
  );

  const actions = useAiSettingsActions({
    isEditMode,
    onEdit: handleEdit,
    onSave: handleSave,
  });

  // Disabled (not hidden) while loading to avoid a flash; hidden once the body
  // has given up on rendering a form at all. Offline hides them for the same
  // reason as an error: there is no config below to edit, so Edit would open an
  // empty form and Save would write it over the tenant's real settings.
  const headerActions =
    hasLoadError || isOffline
      ? undefined
      : isLoading
        ? actions.map(action => ({ ...action, disabled: true }))
        : actions;

  return (
    <AiSettingsLayout actions={headerActions} mobileBottomActions={isEditMode}>
      <LoadingWhen loading={tabsLoading}>
        <AiSettingsTabs tabs={tabs} activeTab={effectiveTab} onTabChange={handleTabChange}>
          {activeId => {
            // Nothing cached: the failure copy instead of editable defaults, so real
            // settings can't be overwritten on save.
            if (!isLoading && (isOffline || hasLoadError)) {
              return (
                <LoadError
                  {...loadErrorProps(
                    isOffline,
                    "Couldn't load AI settings. The service may be temporarily unavailable.",
                    refetchActive,
                  )}
                />
              );
            }

            if (activeId === 'guardrails') {
              return <GuardrailsTab isEditMode={isEditMode} onSaved={() => setIsEditMode(false)} />;
            }

            if (activeId === 'device-guardrails') {
              return <DeviceGuardrailsTab isEditMode={isEditMode} onSaved={() => setIsEditMode(false)} />;
            }

            if (activeId === 'customer') {
              return (
                // While the tab's configuration loads (`null`), the tab draws its own skeleton below the tab bar.
                <CustomerAiAssistantTab
                  aiConfig={isLoading ? null : clientAiConfig}
                  view={isLoading ? null : view}
                  isEditMode={isEditMode}
                  onSubmit={handleCustomerSubmit}
                />
              );
            }

            return (
              <MingoAiChatTab
                aiConfig={isLoading ? null : adminAiConfig}
                isEditMode={isEditMode}
                onSubmit={handleMingoSubmit}
              />
            );
          }}
        </AiSettingsTabs>
      </LoadingWhen>
    </AiSettingsLayout>
  );
}
