'use client';

import { MingoQuickActionWall } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMingoQuickActionChips } from './use-mingo-quick-action-chips';

interface MingoDockQuickActionsProps {
  /** Puts an action's instructions into the docked composer, in a new chat, to edit and send. */
  onPick: (instructions: string) => void;
}

/**
 * Mingo's quick actions above the docked composer on every route but the chat page
 * (`showsDockQuickActions`; FE_PROMPT §3.7, MISSING 1.6): the chat's own quick-action set
 * (`MingoQuickActionWall`, what the chat's empty state draws), read for the page's topic, with
 * no caption over it ("What to ask Mingo?" is the home's button and in the chat history's ⋯).
 * A click puts the action's instructions into the composer to edit and send (`onPick`), the way
 * a conversation starter works: nothing is sent on the click.
 */
export function MingoDockQuickActions({ onPick }: MingoDockQuickActionsProps) {
  // In a loading scope (the dock's own loading form) the set is its loading form too.
  const inScope = useLoadingScope();
  const { chips, loading: chipsLoading } = useMingoQuickActionChips(onPick);

  const loading = chipsLoading || inScope;
  if (chips.length === 0 && !loading) return null;
  return (
    // Inset like the composer card under it (`spacing-system-m`), so the two line up, and the
    // set's distance to it as in the chat's empty state. The set names itself ("Quick actions").
    <div className="mb-[var(--spacing-system-mf)] px-[var(--spacing-system-m)]">
      <MingoQuickActionWall
        quickActions={chips}
        // While the actions are read the wall holds its rows, so the dock keeps its height and
        // the home's greeting, centred above it, does not move when they land.
        loading={loading}
      />
    </div>
  );
}
