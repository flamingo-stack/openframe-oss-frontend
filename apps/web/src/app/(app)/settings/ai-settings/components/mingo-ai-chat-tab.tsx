'use client';
'use no memo';

import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FormEvent } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { useHubDefaultQuickActions } from '../hooks/use-hub-default-quick-actions';
import { getProviderModelLabel, useSupportedModels } from '../hooks/use-supported-models';
import type { AgentAiConfig, AgentAiConfigInput, AiQuickAction } from '../types/ai-settings';
import {
  getMingoAiChatDefaults,
  MINGO_AI_CHAT_FORM_ID,
  type MingoAiChatFormValues,
  mingoAiChatSchema,
  toMingoAiChatSubmit,
} from '../types/mingo-ai-chat.types';
import { AiAnswerStyleFields, AiProviderModelFields } from './ai-config-fields';
import { AiSettingsAdminCard } from './ai-settings-admin-card';
import { AiSettingsQuickActionsSection, MINGO_QUICK_ACTIONS_CONFIG } from './ai-settings-quick-actions';
import { AiSettingsQuickActionsEditor } from './ai-settings-quick-actions-editor';

export { MINGO_AI_CHAT_FORM_ID } from '../types/mingo-ai-chat.types';

interface MingoAiChatTabProps {
  /** `null` while the configuration loads: the tab draws its own skeleton. */
  aiConfig: AgentAiConfig | null;
  isEditMode: boolean;
  onSubmit: (input: AgentAiConfigInput) => void;
}

/**
 * The read-only tab: the summary card and the quick actions. With no configuration (the loading form) every part
 * draws its own loading state in the scope.
 */
function MingoAiChatOverview({
  aiConfig,
  providerModelLabel,
  actions,
}: {
  aiConfig?: AgentAiConfig;
  providerModelLabel?: string;
  actions?: AiQuickAction[];
}) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <AiSettingsAdminCard aiConfig={aiConfig} providerModelLabel={providerModelLabel} />
      <AiSettingsQuickActionsSection
        title="Mingo Quick Actions"
        actions={actions}
        isDefault={aiConfig?.quickActionsIsDefault}
        agentConfig={MINGO_QUICK_ACTIONS_CONFIG}
      />
    </div>
  );
}

export function MingoAiChatTab({ aiConfig, ...props }: MingoAiChatTabProps) {
  // The form below is seeded once from the configuration, so it mounts only when that is in hand. Until then the tab
  // the user asked for (the editor on an edit deep link, else the overview) draws itself in a loading scope.
  if (useLoadingScope() || aiConfig == null) {
    return (
      <LoadingWhen loading>{props.isEditMode ? <MingoAiChatLoadingEditor /> : <MingoAiChatOverview />}</LoadingWhen>
    );
  }
  return <MingoAiChatTabContent aiConfig={aiConfig} {...props} />;
}

function MingoAiChatTabContent({ aiConfig, isEditMode, onSubmit }: MingoAiChatTabProps & { aiConfig: AgentAiConfig }) {
  const form = useForm<MingoAiChatFormValues>({
    resolver: zodResolver(mingoAiChatSchema),
    defaultValues: getMingoAiChatDefaults(aiConfig),
  });

  const { modelsByProvider } = useSupportedModels();

  // OpenFrame defaults come straight from the Product Hub (the BE stores only
  // customs); shown in view mode and as the editor's dimmed preview/seed.
  const hubDefaults = useHubDefaultQuickActions(MINGO_QUICK_ACTIONS_CONFIG.agentSlug);
  // `undefined` until the hub answers: the lists draw their own loading state, never an empty list.
  const defaultActions = hubDefaults.loaded ? hubDefaults.actions : undefined;

  if (!isEditMode) {
    const modelLabel = getProviderModelLabel(modelsByProvider, aiConfig.llmProvider, aiConfig.providerModel);
    return (
      <MingoAiChatOverview
        aiConfig={aiConfig}
        providerModelLabel={modelLabel}
        actions={aiConfig.quickActionsIsDefault ? defaultActions : aiConfig.quickActions}
      />
    );
  }

  return (
    <MingoAiChatEditor
      form={form}
      modelsByProvider={modelsByProvider}
      defaultActions={defaultActions}
      onSubmit={form.handleSubmit(values => onSubmit(toMingoAiChatSubmit(values)))}
    />
  );
}

/** The editor before the configuration is read: the same form, unseeded, every field drawing its own loading state. */
function MingoAiChatLoadingEditor() {
  const form = useForm<MingoAiChatFormValues>();
  return <MingoAiChatEditor form={form} modelsByProvider={undefined} onSubmit={event => event.preventDefault()} />;
}

function MingoAiChatEditor({
  form,
  modelsByProvider,
  defaultActions,
  onSubmit,
}: {
  form: UseFormReturn<MingoAiChatFormValues>;
  modelsByProvider: ReturnType<typeof useSupportedModels>['modelsByProvider'];
  /** `undefined` while the hub defaults are read. */
  defaultActions?: AiQuickAction[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const llmProvider = form.watch('llmProvider');
  const answerStyle = form.watch('answerStyle');

  return (
    <form id={MINGO_AI_CHAT_FORM_ID} onSubmit={onSubmit} className="flex flex-col gap-[var(--spacing-system-l)]">
      <AiProviderModelFields
        control={form.control}
        llmProvider={llmProvider}
        modelsByProvider={modelsByProvider}
        onProviderChange={() => form.setValue('providerModel', '')}
        providerLabel="Mingo LLM Provider"
      />

      <AiAnswerStyleFields control={form.control} answerStyle={answerStyle} />

      <AiSettingsQuickActionsEditor
        control={form.control}
        title="Mingo Quick Actions"
        agentConfig={MINGO_QUICK_ACTIONS_CONFIG}
        defaultActions={defaultActions}
        className="mt-8"
      />
    </form>
  );
}
