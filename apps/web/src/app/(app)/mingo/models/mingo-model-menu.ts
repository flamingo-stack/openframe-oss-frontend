import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { SupportedModelsByProvider } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import { LLM_PROVIDER_LABEL, LLM_PROVIDER_OPTIONS } from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import type { DialogModelInput } from './mingo-model.types';

export function mingoModelMenu({
  modelsByProvider,
  selected,
  disabled,
  select,
}: {
  modelsByProvider: SupportedModelsByProvider | undefined;
  selected: DialogModelInput | null;
  disabled: boolean;
  select: (model: DialogModelInput | null) => Promise<void>;
}): ActionsMenuItem[] {
  return [
    {
      id: 'chat-model',
      label: 'Chat Model',
      type: 'submenu',
      disabled,
      submenu: [
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
          type: 'submenu' as const,
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
