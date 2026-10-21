'use client';
'use no memo';

import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  CheckboxBlock,
  ColorPickerInput,
  ImageUploader,
  Input,
  LoadError,
  LoadingWhen,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  AiAnswerStyleFields,
  AiProviderModelFields,
} from '@/app/(app)/settings/ai-settings/components/ai-config-fields';
import {
  AiSettingsQuickActions,
  ASSISTANT_QUICK_ACTIONS_CONFIG,
} from '@/app/(app)/settings/ai-settings/components/ai-settings-quick-actions';
import { AiSettingsQuickActionsEditor } from '@/app/(app)/settings/ai-settings/components/ai-settings-quick-actions-editor';
import { AiSettingsPreviews } from '@/app/(app)/settings/ai-settings/components/previews/ai-settings-previews';
import { useClientAiConfig } from '@/app/(app)/settings/ai-settings/hooks/use-agent-ai-config';
import {
  clientViewQueryKeys,
  useClientView,
  useResetClientView,
  useUpdateClientView,
  withClientViewCreateFields,
} from '@/app/(app)/settings/ai-settings/hooks/use-client-view';
import { useHubDefaultQuickActions } from '@/app/(app)/settings/ai-settings/hooks/use-hub-default-quick-actions';
import {
  useOrganizationClientAiConfig,
  useResetOrganizationClientAiConfig,
  useResetOrganizationClientAiQuickActions,
  useUpdateOrganizationClientAiConfig,
} from '@/app/(app)/settings/ai-settings/hooks/use-organization-ai-config';
import { useSupportedModels } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import { toAgentAiConfigInput } from '@/app/(app)/settings/ai-settings/types/ai-logic.types';
import { getDefaultClientView } from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { useCustomerAiConfigurationForm } from './use-customer-ai-configuration-form';

/** Imperative API the parent ("Save Customer") drives to persist this block. */
export interface CustomerAiConfigurationHandle {
  /** Validates the custom fields. Resolves false when the user must fix them first. */
  validate: () => Promise<boolean>;
  /** Persists the configuration: updates both overrides, or nothing when inheriting. */
  commit: () => Promise<void>;
}

interface CustomerAiConfigurationProps {
  /** Organization the configuration is scoped to (edit mode only). */
  organizationId: string;
}

/**
 * "Customer AI Configuration" tab on the customer edit page. Reuses the global
 * CLIENT screen's schema and field components, but scopes everything to one
 * organization across the two backend overrides: ClientView (name/avatar/
 * theme/accent) and OrganizationClientAiConfig (provider/model/answer style/
 * quick actions). One "use default" toggle governs both — checking it resets
 * both overrides (after confirm); unchecked, "Save Customer" persists both via
 * the `validate()` / `commit()` ref handle.
 */
export const CustomerAiConfiguration = forwardRef<CustomerAiConfigurationHandle, CustomerAiConfigurationProps>(
  function CustomerAiConfigurationImpl({ organizationId }, ref) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const scoped = useLoadingScope();

    // Org-scoped overrides (view is null / config inherits when not overridden).
    const { view: orgView, isLoading: isViewLoading } = useClientView(organizationId);
    const {
      config: orgConfig,
      isLoading: isConfigLoading,
      error: configError,
      refetch: refetchConfig,
    } = useOrganizationClientAiConfig(organizationId);
    // Tenant-wide default appearance: previews while inheriting.
    const { view: defaultView } = useClientView(null);

    const { update: updateView } = useUpdateClientView(organizationId, { invalidateOnSuccess: false });
    const { reset: resetView, isPending: isResettingView } = useResetClientView(organizationId);
    const { update: updateAiConfig } = useUpdateOrganizationClientAiConfig(organizationId);
    const { reset: resetAiConfig, isPending: isResettingAi } = useResetOrganizationClientAiConfig(organizationId);
    const { resetQuickActions } = useResetOrganizationClientAiQuickActions(organizationId);
    const { modelsByProvider } = useSupportedModels();

    const [useDefault, setUseDefault] = useState(true);
    const [confirmResetOpen, setConfirmResetOpen] = useState(false);

    // OpenFrame default quick actions from the Product Hub (the BE stores only
    // customs); the editor shows them as the dimmed preview / uncheck seed, and
    // the inherit view shows them when the tenant default keeps OpenFrame's set.
    const hubDefaults = useHubDefaultQuickActions(ASSISTANT_QUICK_ACTIONS_CONFIG.agentSlug);
    // Tenant CLIENT default config — the source of the quick actions this
    // customer inherits (the inherit view and the editor's "default" seed).
    // The org config's `quickActions` is the customer's own list when
    // customized, so it can't serve as the inherited set.
    const { config: clientAiConfig } = useClientAiConfig();
    // Effective inherited quick actions: the tenant's customs when it overrode
    // the OpenFrame set, otherwise the hub defaults (mirrors the settings view).
    const inheritedQuickActionsAreDefault = clientAiConfig?.quickActionsIsDefault ?? true;
    const inheritedQuickActions = inheritedQuickActionsAreDefault
      ? hubDefaults.actions
      : (clientAiConfig?.quickActions ?? []);

    const hasAiOverride = !!orgConfig && !orgConfig.inheritDefault;
    const hasAnyOverride = !!orgView || hasAiOverride;

    // Seed the toggle once both org records have loaded: any existing override
    // starts in custom mode, otherwise the customer inherits the defaults.
    const seededRef = useRef(false);
    useEffect(() => {
      if (seededRef.current || isViewLoading || isConfigLoading || !orgConfig) return;
      seededRef.current = true;
      setUseDefault(!orgView && orgConfig.inheritDefault);
    }, [isViewLoading, isConfigLoading, orgView, orgConfig]);

    const effectiveView = orgView ?? defaultView ?? getDefaultClientView(organizationId);
    const fallbackDefault = defaultView ?? getDefaultClientView(null);

    const { form, avatarUrl, handleAvatarChange, handleAvatarRemove, commitAvatar } = useCustomerAiConfigurationForm({
      view: effectiveView,
      config: orgConfig,
    });

    const assistantName = form.watch('assistantName');
    const accentColor = form.watch('accentColor');
    const llmProvider = form.watch('llmProvider');
    const answerStyle = form.watch('answerStyle');

    // Persistence is driven by the page's "Save Customer" button.
    useImperativeHandle(
      ref,
      () => ({
        // Until the seed effect has reflected server state into the toggle
        // (org queries loading or errored), this block must not validate or
        // write — an unseeded `useDefault: true` would silently reset the
        // customer's existing overrides on an unrelated "Save Customer".
        validate: () => (!seededRef.current || useDefault ? Promise.resolve(true) : form.trigger()),
        commit: async () => {
          if (!seededRef.current) return;
          if (useDefault) {
            // Overrides are dropped when the user confirms the toggle; this
            // covers the case where one still exists at save time.
            if (orgView) await resetView();
            if (hasAiOverride) await resetAiConfig();
            return;
          }
          const values = form.getValues();

          // No override yet: this save creates the customer's own view.
          const savedView = await updateView(
            withClientViewCreateFields(
              { assistantName: values.assistantName, accentColor: values.accentColor },
              !orgView,
            ),
          );

          await updateAiConfig(toAgentAiConfigInput(values));
          // The update omits `quickActions` while defaults are on, and the
          // backend ignores `quickActionsIsDefault` for orgs — clearing an
          // existing custom list back to "follow the tenant" needs the
          // dedicated reset mutation or it would be a silent no-op.
          if (values.quickActionsIsDefault && orgConfig?.quickActionsIsDefault === false) {
            await resetQuickActions();
          }

          // Avatar last: its failure must not drop the config writes above.
          const clientViewId = savedView?.id ?? orgView?.id;
          if (clientViewId) await commitAvatar(clientViewId);

          // Single refetch after the avatar lands — the view and its avatar
          // live in separate stores, so this is where both are current.
          await queryClient.invalidateQueries({ queryKey: clientViewQueryKeys.detail(organizationId) });
        },
      }),
      [
        useDefault,
        organizationId,
        orgView,
        orgConfig,
        hasAiOverride,
        form,
        updateView,
        updateAiConfig,
        resetView,
        resetAiConfig,
        resetQuickActions,
        commitAvatar,
        queryClient,
      ],
    );

    const handleToggle = (checked: boolean) => {
      if (!checked) {
        setUseDefault(false);
        return;
      }
      // Switching back to defaults: confirm first; overrides are reset on confirm.
      if (hasAnyOverride) {
        setConfirmResetOpen(true);
        return;
      }
      setUseDefault(true);
    };

    // While the overrides load the block draws itself in a loading scope: the toggle's copy for real and its box a
    // skeleton, the default branch below it (the starting state), then the previews and the quick actions each their
    // own skeleton.
    const loading = scoped || isViewLoading || isConfigLoading;

    const toggleRow = (
      <CheckboxBlock
        id="use-default-ai-configuration"
        label="Use the default AI-Assistant configuration"
        description="Inherits all AI-Assistant settings from your global configuration."
        checked={useDefault}
        onCheckedChange={checked => handleToggle(Boolean(checked))}
        trailing={
          <Button
            type="button"
            variant="outline"
            onClick={e => {
              e.preventDefault();
              router.push(routes.settings.aiSettings({ tab: 'customer', edit: true }));
            }}
            leftIcon={<PenEditIcon className="size-5 text-ods-text-secondary" />}
            className="w-full content-md:w-auto"
          >
            Edit Default Configuration
          </Button>
        }
      />
    );

    if (!loading && configError) {
      return (
        <LoadError
          message="Couldn't load the customer AI configuration. The service may be temporarily unavailable."
          onRetry={() => void refetchConfig()}
        />
      );
    }

    return (
      <LoadingWhen loading={loading}>
        <div className="flex flex-col gap-[var(--spacing-system-l)] content-max-md:[&_input]:!text-[14px] content-max-md:[&_textarea]:!text-[14px]">
          {toggleRow}

          {useDefault ? (
            <>
              <AiSettingsPreviews
                assistantName={fallbackDefault.assistantName}
                avatarUrl={getFullImageUrl(
                  fallbackDefault.assistantAvatar?.imageUrl,
                  fallbackDefault.assistantAvatar?.hash,
                )}
                accentColor={fallbackDefault.accentColor}
              />

              {/* Quick actions stay visible while inheriting the default config —
                read-only, showing the tenant default set (editing lives in
                custom mode). */}
              <div className="flex flex-col gap-[var(--spacing-system-l)]">
                <span className="text-ods-text-primary text-h2">Assistant Quick Actions</span>
                <AiSettingsQuickActions
                  actions={loading ? [] : inheritedQuickActions}
                  // Unknown while loading: the header names whose list it is only once that is read.
                  isDefault={loading ? undefined : inheritedQuickActionsAreDefault}
                  agentConfig={ASSISTANT_QUICK_ACTIONS_CONFIG}
                  accent={fallbackDefault.accentColor}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-[var(--spacing-system-l)] content-md:flex-row content-md:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-l)]">
                  <Controller
                    name="assistantName"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Input {...field} label="Assistant Name" error={fieldState.error?.message} />
                    )}
                  />

                  <AiProviderModelFields
                    control={form.control}
                    llmProvider={llmProvider}
                    modelsByProvider={modelsByProvider}
                    onProviderChange={() => form.setValue('providerModel', '')}
                  />
                </div>

                <div className="w-full shrink-0 content-md:w-[274px]">
                  <ImageUploader
                    fieldLabel="Assistant Avatar"
                    value={avatarUrl}
                    onChange={handleAvatarChange}
                    onRemove={handleAvatarRemove}
                    className="[&>div]:!h-[154px] content-md:[&>div]:!h-[148px] [&_button]:size-10 [&_button]:p-2 content-md:[&_button]:size-12 content-md:[&_button]:p-3"
                    alt={assistantName || effectiveView.assistantName}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border p-[var(--spacing-system-l)]">
                {/* The accent is the only appearance setting (the client picks the theme
                  in the Fae app). Same two columns as the previews below, so the field
                  ends where the welcome preview does. */}
                <div className="grid gap-[var(--spacing-system-l)] content-md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
                    <p className="text-ods-text-primary text-h3">Accent Color</p>
                    <Controller
                      name="accentColor"
                      control={form.control}
                      render={({ field }) => <ColorPickerInput value={field.value} onChange={field.onChange} />}
                    />
                  </div>
                </div>

                <AiSettingsPreviews
                  assistantName={assistantName || effectiveView.assistantName}
                  avatarUrl={avatarUrl}
                  accentColor={accentColor || effectiveView.accentColor}
                />
              </div>

              <AiAnswerStyleFields control={form.control} answerStyle={answerStyle} />

              {/* "Default" here inherits the tenant's configured quick actions
                (which may be customs), NOT OpenFrame's set — so the preview and
                copy reflect the global config, unlike the tenant-wide screen. */}
              <AiSettingsQuickActionsEditor
                control={form.control}
                agentConfig={ASSISTANT_QUICK_ACTIONS_CONFIG}
                defaultActions={inheritedQuickActions}
                accent={accentColor || effectiveView.accentColor}
                defaultActionsCopy={{
                  title: 'Use default quick actions',
                  description: 'Inherits the quick actions from your global AI-Assistant configuration.',
                  confirmDescription:
                    'This replaces your customized quick actions with the ones from your global AI-Assistant configuration. Any actions you added or edited will be removed.',
                  previewIsOpenFrame: inheritedQuickActionsAreDefault,
                }}
              />
            </>
          )}

          <ConfirmDialog
            open={confirmResetOpen}
            onOpenChange={setConfirmResetOpen}
            title="Use Default Settings"
            description="The custom AI-Assistant configuration for this customer will be removed. They will use the tenant default instead."
            confirmLabel="Use default"
            variant="destructive"
            isPending={isResettingView || isResettingAi}
            pendingLabel="Removing..."
            onConfirm={async () => {
              try {
                if (orgView) await resetView();
                if (hasAiOverride) await resetAiConfig();
                setUseDefault(true);
                setConfirmResetOpen(false);
                toast({
                  title: 'Saved',
                  description: 'Customer now uses the default AI-Assistant configuration',
                  variant: 'success',
                });
              } catch (err) {
                toast({
                  title: 'Save failed',
                  description: err instanceof Error ? err.message : 'Failed to remove the custom configuration',
                  variant: 'destructive',
                });
              }
            }}
          />
        </div>
      </LoadingWhen>
    );
  },
);
CustomerAiConfiguration.displayName = 'CustomerAiConfiguration';
