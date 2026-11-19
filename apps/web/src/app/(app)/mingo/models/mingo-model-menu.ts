import {
  AnthropicLogoGreyIcon,
  GeminiLogoGreyIcon,
  OpenaiLogoGreyIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { createElement } from 'react';
import type { SupportedModelsByProvider } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import { LLM_PROVIDER_LABEL, LLM_PROVIDER_OPTIONS } from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import type { DialogModel, DialogModelInput } from './mingo-model.types';

const PROVIDER_ICONS = {
  ANTHROPIC: createElement(AnthropicLogoGreyIcon, { className: 'h-5 w-5' }),
  OPENAI: createElement(OpenaiLogoGreyIcon, { className: 'h-5 w-5' }),
  GOOGLE_GEMINI: createElement(GeminiLogoGreyIcon, { className: 'h-5 w-5' }),
};

export function mingoModelMenu({
  modelsByProvider,
  selected,
  currentModel,
  disabled,
  select,
  unavailable = false,
  retry,
  retryDisabled = false,
}: {
  modelsByProvider: SupportedModelsByProvider | undefined;
  selected: DialogModelInput | null;
  currentModel: DialogModel | null;
  disabled: boolean;
  select: (model: DialogModelInput | null) => Promise<void>;
  unavailable?: boolean;
  retry?: () => void;
  retryDisabled?: boolean;
}): ActionsMenuItem[] {
  return [
    {
      id: 'chat-model',
      label:
        currentModel?.displayName ?? currentModel?.modelName ?? (unavailable ? 'Model unavailable' : 'Loading model…'),
      description: 'Chat Model',
      type: 'submenu',
      submenuBoundary: 'viewport',
      disabled: unavailable ? retryDisabled || !retry : disabled,
      submenu: unavailable
        ? [{ id: 'retry-models', label: 'Retry loading models', disabled: retryDisabled, onClick: retry }]
        : [
            {
              id: 'default-model',
              label: 'Use Default Model',
              type: 'radio',
              disabled,
              checked: selected === null,
              onClick: () => void select(null),
            },
            ...LLM_PROVIDER_OPTIONS.filter(provider => modelsByProvider?.[provider]?.length).map(provider => ({
              id: provider,
              label: LLM_PROVIDER_LABEL[provider],
              icon: PROVIDER_ICONS[provider],
              type: 'submenu' as const,
              submenuBoundary: 'viewport' as const,
              disabled,
              submenu: modelsByProvider?.[provider]?.map(model => ({
                id: `${provider}:${model.value}`,
                label: model.label,
                type: 'radio' as const,
                disabled,
                checked: selected?.provider === provider && selected.modelName === model.value,
                onClick: () => void select({ provider, modelName: model.value }),
              })),
            })),
          ],
    },
  ];
}
