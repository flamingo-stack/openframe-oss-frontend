'use client';

import {
  getAgentAccent,
  type MingoQuickAction,
  renderQuickActionIcon,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import { useMingoQuickActions } from '@/app/(app)/mingo/hooks/use-mingo-quick-actions';

/**
 * Admin-configured Mingo quick actions (AI Settings → "Mingo AI Chat" tab, else the hub
 * defaults) as the chat's quick-action chips: the chat's empty state (`mingoWelcome`) and
 * the dock's wall on Mingo's home draw the same ones. A click SENDS the action's
 * instructions in a new chat (`send`); the chip's `prompt` is what hover previews.
 */
export function useMingoQuickActionChips(send: (instructions: string) => void): MingoQuickAction[] {
  const quickActions = useMingoQuickActions();
  return useMemo<MingoQuickAction[]>(
    () =>
      quickActions.map(action => ({
        id: action.id,
        label: action.name,
        variant: 'outline',
        // Product Hub defaults carry a glyph (iconName/iconUrl/iconProps) and
        // tenant customs the `iconName` picked in AI Settings; render it into
        // the chip node. No icon → undefined → a text-only chip. `mingo` accent
        // tints registry glyphs unless the hub icon sets its own color.
        icon: renderQuickActionIcon({
          name: action.iconName ?? undefined,
          url: action.iconUrl ?? undefined,
          props: action.iconProps ?? undefined,
          accent: getAgentAccent('mingo'),
        }),
        // Hover/focus previews the full instruction (what's actually sent) as
        // ghost text in the composer; the chip `label` is just the short name.
        prompt: action.instructions,
        onClick: () => send(action.instructions),
      })),
    [quickActions, send],
  );
}
