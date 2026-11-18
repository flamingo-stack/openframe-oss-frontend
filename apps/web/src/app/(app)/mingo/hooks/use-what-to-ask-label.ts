'use client';

import { useWhatToAskCommand, whatToAskLabelOf } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';

/**
 * "What to ask?"'s label, or null when there is no such entry: the `/what-can-you-do` command as the hub's command
 * catalog lists it (the same one the chat reads). Every entry this app draws (the new chat, Start Work, the history's
 * ⋯) is shown only with it and says only what the hub names it.
 */
export function useWhatToAskLabel(): string | null {
  const command = useWhatToAskCommand(useChatRuntime()?.endpoints.commandsUrl);
  return command ? whatToAskLabelOf(command) : null;
}
