'use client';

import { type MingoQuickAction, renderQuickActionIcon } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import { useMingoQuickActions } from '@/app/(app)/mingo/hooks/use-mingo-quick-actions';

/**
 * The icon tint of every quick action in OpenFrame (the dock's row, the chat's empty states): the
 * tag's own text colour, not an agent's accent, as the design's row draws them.
 */
export const OPENFRAME_QUICK_ACTION_ACCENT = 'currentColor';

/**
 * Admin-configured Mingo quick actions (AI Settings → "Mingo AI Chat" tab, else the hub
 * defaults) as the chat's quick-action chips: the chat's empty state (`mingoWelcome`) and
 * the dock's set draw the same ones. The chip's `prompt` is the action's instructions: the
 * chat sends it on a click by itself; a host that draws the set outside the chat (the dock)
 * passes `send` for its click.
 */
export function useMingoQuickActionChips(send?: (instructions: string) => void): {
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
        // the chip node. No icon → undefined → a text-only chip. The glyph is drawn in the
        // tag's own text colour, as the row's "All" glyph is (`OPENFRAME_QUICK_ACTION_ACCENT`),
        // unless the hub icon sets its own color.
        icon: renderQuickActionIcon({
          name: action.iconName ?? undefined,
          url: action.iconUrl ?? undefined,
          props: action.iconProps ?? undefined,
          accent: OPENFRAME_QUICK_ACTION_ACCENT,
        }),
        // The full instruction; the chip `label` is just the short name.
        prompt: action.instructions,
        onClick: send ? () => send(action.instructions) : undefined,
      })),
    [quickActions, send],
  );
  return { chips, loading };
}
