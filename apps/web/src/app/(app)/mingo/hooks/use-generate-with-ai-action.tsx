'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import type { SplitButtonIconAction } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { DialogIntent } from '../../tickets/constants';
import { useMingoLauncherStore } from '../stores/mingo-launcher-store';

/**
 * "Generate with AI": the Mingo segment of a create button. It opens Mingo on a
 * new dialog created with `intent`, where Mingo greets first and walks the user
 * through creating that entity. Inert while no chat is mounted to receive it
 * (a locked workspace), like every other Mingo launcher. Mingo's mark is its
 * identity's (`AgentMark`), as every Mingo icon is.
 */
export function useGenerateWithAiAction(intent: DialogIntent): SplitButtonIconAction {
  const canOpenMingo = useMingoLauncherStore(state => state.dockMounted);
  const startIntentChat = useMingoLauncherStore(state => state.startIntentChat);

  return {
    // In the button's own colour, as the icon beside it: dark on an accent (an empty list's create
    // button), secondary on an outline one.
    icon: <AgentMark agent="mingo" className="h-6 w-6" color="currentColor" />,
    'aria-label': 'Generate with AI',
    onClick: () => startIntentChat(intent),
    disabled: !canOpenMingo,
  };
}
