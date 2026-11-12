'use client';

import { MingoQuickActionWall } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMingoQuickActionChips } from './use-mingo-quick-action-chips';

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
  // In a loading scope (the dock's own loading form) the set is its loading form too.
  const inScope = useLoadingScope();
  const { chips, loading: chipsLoading } = useMingoQuickActionChips(onSend);

  const loading = chipsLoading || inScope;
  if (chips.length === 0 && !loading) return null;
  return (
    // Inset like the composer card under it (`spacing-system-m`), so the two line up, and the
    // row's distance to it as the design's dock draws it (`spacing-system-xs`). The row names
    // itself ("Quick actions").
    <div className="mb-[var(--spacing-system-xs)] px-[var(--spacing-system-m)]">
      <MingoQuickActionWall
        quickActions={chips}
        // While the actions are read the row holds its place, so the dock keeps its height and
        // the home's greeting, centred above it, does not move when they land.
        loading={loading}
      />
    </div>
  );
}
