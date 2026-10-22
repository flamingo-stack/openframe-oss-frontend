'use client';

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { SplitButtonIconAction } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { DialogIntent } from '../../tickets/constants';
import { useMingoLauncherStore } from '../stores/mingo-launcher-store';

/**
 * "Generate with AI": the Mingo segment of a create button. It opens Mingo on a
 * new dialog created with `intent`, where Mingo greets first and walks the user
 * through creating that entity. Inert while no chat is mounted to receive it
 * (a locked workspace), like every other Mingo launcher.
 */
export function useGenerateWithAiAction(intent: DialogIntent): SplitButtonIconAction {
  const canOpenMingo = useMingoLauncherStore(state => state.canOpen);
  const startIntentChat = useMingoLauncherStore(state => state.startIntentChat);

  return {
    icon: <MingoIcon className="h-6 w-6" />,
    'aria-label': 'Generate with AI',
    onClick: () => startIntentChat(intent),
    disabled: !canOpenMingo,
  };
}
