'use client';

import { MingoQuickActionWall } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useManhattanDock } from '../manhattan-shell/manhattan-dock-context';
import { OPENFRAME_QUICK_ACTION_ACCENT, useMingoQuickActionChips } from './use-mingo-quick-action-chips';

/** The row's side inset, the composer's (`ChatComposer` `inset`): `always`, or `wide` (none below `content-md`). */
const ROW_INSET_CLASS = {
  always: 'px-[var(--spacing-system-m)]',
  wide: 'px-0 content-md:px-[var(--spacing-system-m)]',
} as const;

interface MingoDockQuickActionsProps {
  /** Sends an action's instructions in a new chat (the dock's own send, which then opens it). */
  onSend: (instructions: string) => void;
}

/**
 * Mingo's quick actions above the docked composer on Mingo's home (`showsDockQuickActions`):
 * the chat's own quick-action row (`MingoQuickActionWall`, what the chat's empty state draws:
 * one line of tags that scrolls sideways, "All" at its right), with no caption over it ("What to ask Mingo?" is the home's button and in the chat history's ⋯).
 * A click sends the action's instructions at once (`onSend`).
 */
export function MingoDockQuickActions({ onSend }: MingoDockQuickActionsProps) {
  // The composer's own rule (`MingoComposerDock`: `composerInset={manhattan && !mdDown ? 'wide' : undefined}`).
  const manhattan = useManhattanDock();
  const mdUp = useMdUp();
  const insetWide = manhattan && mdUp !== false;
  // In a loading scope (the dock's own loading form) the set is its loading form too.
  const inScope = useLoadingScope();
  const { chips, loading: chipsLoading } = useMingoQuickActionChips(onSend);

  const loading = chipsLoading || inScope;
  if (chips.length === 0 && !loading) return null;
  return (
    // Inset exactly like the composer card under it, so the two line up at every width. The dock
    // picks the composer's inset by the same rule (`composerInset`): from md in v2 it is `wide`,
    // none under 720px of content (a narrow column, the 800–911px one-column layout) and
    // `spacing-system-m` from there; on a phone, and outside v2, always `spacing-system-m`. The
    // row's distance to it as the design's dock draws it (`spacing-system-xs`). The row names
    // itself ("Quick actions").
    <div className={cn('mb-[var(--spacing-system-xs)]', ROW_INSET_CLASS[insetWide ? 'wide' : 'always'])}>
      <MingoQuickActionWall
        quickActions={chips}
        // The row's "All" glyph in the grey of its chips' icons.
        accent={OPENFRAME_QUICK_ACTION_ACCENT}
        // While the actions are read the row holds its place, so the dock keeps its height and
        // the home's greeting, centred above it, does not move when they land.
        loading={loading}
      />
    </div>
  );
}
