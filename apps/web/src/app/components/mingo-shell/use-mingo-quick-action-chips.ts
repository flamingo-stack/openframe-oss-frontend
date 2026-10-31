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
 * the dock's set draw the same ones. The chip's `prompt` is the action's instructions: the
 * chat puts it into its composer on a click by itself; a host that draws the set outside the
 * chat (the dock) passes `pick` for its click.
 */
export function useMingoQuickActionChips(pick?: (instructions: string) => void): {
  chips: MingoQuickAction[];
  /** The actions are still read: a wall holds its place with its loading form. */
  loading: boolean;
} {
  const { actions: quickActions, loading } = useMingoQuickActions();
  const chips = useMemo<MingoQuickAction[]>(
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
        // The full instruction; the chip `label` is just the short name.
        prompt: action.instructions,
        onClick: pick ? () => pick(action.instructions) : undefined,
      })),
    [quickActions, pick],
  );
  return { chips, loading };
}
