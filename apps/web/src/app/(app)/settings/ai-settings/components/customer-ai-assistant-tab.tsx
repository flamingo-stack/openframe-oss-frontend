'use client';
'use no memo';

import {
  ColorPickerInput,
  ImageUploader,
  Input,
  LoadingWhen,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { BaseSyntheticEvent } from 'react';
import { Controller, type UseFormReturn, useForm } from 'react-hook-form';
import { noop } from '@/app/components/shared';
import { type CommitAvatar, useCustomerAiAssistantForm } from '../hooks/use-customer-ai-assistant-form';
import { useHubDefaultQuickActions } from '../hooks/use-hub-default-quick-actions';
import {
  getProviderModelLabel,
  type SupportedModelsByProvider,
  useSupportedModels,
} from '../hooks/use-supported-models';
import type { AgentAiConfig, AiQuickAction, ClientView } from '../types/ai-settings';
import {
  CUSTOMER_AI_ASSISTANT_FORM_ID,
  type CustomerAiAssistantFormValues,
  type CustomerAiAssistantSubmit,
} from '../types/customer-ai-assistant.types';
import { AiAnswerStyleFields, AiProviderModelFields } from './ai-config-fields';
import { AiSettingsOverview } from './ai-settings-overview';
import { ASSISTANT_QUICK_ACTIONS_CONFIG } from './ai-settings-quick-actions';
import { AiSettingsQuickActionsEditor } from './ai-settings-quick-actions-editor';
import { AiSettingsPreviews } from './previews/ai-settings-previews';

export { CUSTOMER_AI_ASSISTANT_FORM_ID } from '../types/customer-ai-assistant.types';

interface CustomerAiAssistantTabProps {
  /** `null` (with `view`) while the configuration loads: the tab draws its own skeleton. */
  aiConfig: AgentAiConfig | null;
  view: ClientView | null;
  isEditMode: boolean;
  onSubmit: (payload: CustomerAiAssistantSubmit, commitAvatar: CommitAvatar) => void;
}

export function CustomerAiAssistantTab({ aiConfig, view, ...props }: CustomerAiAssistantTabProps) {
  // The form below is seeded once from the configuration, so it mounts only when that is in hand. Until then the tab
  // the user asked for (the editor on an edit deep link, else the read-only overview) draws itself in a loading scope.
  if (useLoadingScope() || aiConfig == null || view == null) {
    return (
      <LoadingWhen loading>
        {props.isEditMode ? <CustomerAiAssistantLoadingEditor /> : <AiSettingsOverview />}
      </LoadingWhen>
    );
  }
  return <CustomerAiAssistantTabContent aiConfig={aiConfig} view={view} {...props} />;
}

function CustomerAiAssistantTabContent({
  aiConfig,
  view,
  isEditMode,
  onSubmit,
}: CustomerAiAssistantTabProps & { aiConfig: AgentAiConfig; view: ClientView }) {
  const { form, avatarUrl, handleAvatarChange, handleAvatarRemove, handleSubmit } = useCustomerAiAssistantForm({
    aiConfig,
    view,
    onSubmit,
  });

  const { modelsByProvider } = useSupportedModels();

  // OpenFrame defaults come straight from the Product Hub (the BE stores only
  // customs); shown in view mode and as the editor's dimmed preview/seed.
  const hubDefaults = useHubDefaultQuickActions(ASSISTANT_QUICK_ACTIONS_CONFIG.agentSlug);
  // `undefined` until the hub answers: the lists draw their own loading state, never an empty list.
  const defaultActions = hubDefaults.loaded ? hubDefaults.actions : undefined;

  if (!isEditMode) {
    const modelLabel = getProviderModelLabel(modelsByProvider, aiConfig.llmProvider, aiConfig.providerModel);
    return (
      <AiSettingsOverview
        aiConfig={aiConfig}
        view={view}
        providerModelLabel={modelLabel}
        quickActions={aiConfig.quickActionsIsDefault ? defaultActions : aiConfig.quickActions}
      />
    );
  }

  return (
    <CustomerAiAssistantEditor
      form={form}
      view={view}
      modelsByProvider={modelsByProvider}
      defaultActions={defaultActions}
      avatarUrl={avatarUrl}
      onAvatarChange={handleAvatarChange}
      onAvatarRemove={handleAvatarRemove}
      onSubmit={handleSubmit}
    />
  );
}

/** The editor before the configuration is read: the same form, unseeded, every field drawing its own loading state. */
function CustomerAiAssistantLoadingEditor() {
  const form = useForm<CustomerAiAssistantFormValues>();
  return (
    <CustomerAiAssistantEditor
      form={form}
      view={null}
      modelsByProvider={undefined}
      avatarUrl={undefined}
      onAvatarChange={noop}
      onAvatarRemove={noop}
      onSubmit={event => event?.preventDefault()}
    />
  );
}

function CustomerAiAssistantEditor({
  form,
  view,
  modelsByProvider,
  defaultActions,
  avatarUrl,
  onAvatarChange,
  onAvatarRemove,
  onSubmit,
}: {
  form: UseFormReturn<CustomerAiAssistantFormValues>;
  /** `null` while the configuration loads. */
  view: ClientView | null;
  modelsByProvider: SupportedModelsByProvider | undefined;
  /** `undefined` while the hub defaults are read. */
  defaultActions?: AiQuickAction[];
  avatarUrl: string | undefined;
  onAvatarChange: (file: File) => void;
  onAvatarRemove: () => void;
  onSubmit: (event?: BaseSyntheticEvent) => void;
}) {
  const llmProvider = form.watch('llmProvider');
  const answerStyle = form.watch('answerStyle');
  const assistantName = form.watch('assistantName');
  const accentColor = form.watch('accentColor');

  return (
    <form
      id={CUSTOMER_AI_ASSISTANT_FORM_ID}
      onSubmit={onSubmit}
      className="flex flex-col gap-[var(--spacing-system-l)] content-max-md:[&_input]:!text-[14px] content-max-md:[&_textarea]:!text-[14px]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)] content-md:flex-row content-md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-l)]">
          <Controller
            name="assistantName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input {...field} label="Assistant Name" labelVariant="large" error={fieldState.error?.message} />
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
            labelVariant="large"
            value={avatarUrl}
            onChange={onAvatarChange}
            onRemove={onAvatarRemove}
            className="[&>div]:!h-[154px] content-md:[&>div]:!h-[148px] [&_button]:size-10 [&_button]:p-2 content-md:[&_button]:size-12 content-md:[&_button]:p-3"
            alt={view?.assistantName}
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
          assistantName={assistantName || view?.assistantName}
          avatarUrl={avatarUrl}
          accentColor={accentColor || view?.accentColor}
        />
      </div>

      <AiAnswerStyleFields control={form.control} answerStyle={answerStyle} />

      <AiSettingsQuickActionsEditor
        control={form.control}
        title="Assistant Quick Actions"
        agentConfig={ASSISTANT_QUICK_ACTIONS_CONFIG}
        defaultActions={defaultActions}
        accent={accentColor || view?.accentColor}
        className="mt-8"
      />
    </form>
  );
}
