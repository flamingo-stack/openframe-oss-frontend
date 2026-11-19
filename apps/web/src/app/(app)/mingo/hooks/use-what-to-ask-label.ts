'use client';

import {
  useSlashCommandRegistry,
  useWhatToAskCommand,
  whatToAskLabelOf,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';

/** "What to ask?" as a screen draws it: its label, and whether the hub's catalog is still being read. */
export interface WhatToAskEntry {
  /** The entry's label as the hub names it; null when the catalog lists no such command (or is not read yet). */
  label: string | null;
  /**
   * The catalog has not answered yet, so whether there is an entry is not known. A screen that lays its content out
   * around the entry draws the button's loading form in its place meanwhile (the lib's `InteractiveSkeleton.Button`),
   * so nothing moves when it lands.
   */
  pending: boolean;
}

/**
 * "What to ask?": the `/what-can-you-do` command as the hub's command catalog lists it (the same one the chat reads,
 * one cached request for both). Every entry this app draws (the new chat, Start Work, the history's ⋯) is shown only
 * with it and says only what the hub names it.
 */
export function useWhatToAsk(): WhatToAskEntry {
  const commandsUrl = useChatRuntime()?.endpoints.commandsUrl;
  const command = useWhatToAskCommand(commandsUrl);
  // The same cache entry `useWhatToAskCommand` reads: this adds no request, only whether the answer is in. With no
  // runtime there is nothing to wait for.
  const { loading } = useSlashCommandRegistry(commandsUrl ?? '', { enabled: Boolean(commandsUrl) });
  return { label: command ? whatToAskLabelOf(command) : null, pending: loading };
}

/** "What to ask?"'s label, or null when there is no such entry: for a menu, where nothing is laid out around it. */
export function useWhatToAskLabel(): string | null {
  return useWhatToAsk().label;
}
