'use client';

import { MingoQuickActionWall } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useRef } from 'react';
import { useComposerPreviewStore } from './composer-preview-store';
import { useMingoQuickActionChips } from './use-mingo-quick-action-chips';

interface MingoDockQuickActionsProps {
  /** Sends an action's instructions in a new chat (the dock's own send, which then opens it). */
  onSend: (instructions: string) => void;
}

/**
 * Mingo's quick actions above the docked composer on the home (FE_PROMPT §3.7, MISSING
 * 1.6): the chat's own quick-action wall (`MingoQuickActionWall`, what the classic chat's
 * empty state drew), with no caption over it ("What to ask Mingo?" is the home's button
 * and in the chat history's ⋯). A click SENDS the action's instructions in a new chat; hover or focus
 * previews them as ghost text in the composer (the chip's short name does not say what
 * it sends). With no actions it draws nothing.
 */
export function MingoDockQuickActions({ onSend }: MingoDockQuickActionsProps) {
  const showPreview = useComposerPreviewStore(s => s.show);
  const hidePreview = useComposerPreviewStore(s => s.hide);
  const clearPreview = useComposerPreviewStore(s => s.clear);
  const chips = useMingoQuickActionChips(instructions => {
    clearPreview();
    onSend(instructions);
  });
  // The preview a chip put up, for the hover end (the wall does not say which chip left).
  const previewedRef = useRef<string | null>(null);

  // The preview belongs to the chips on screen: leaving home (a click's chat page
  // included) must not leave it in the composer.
  useEffect(() => clearPreview, [clearPreview]);

  if (chips.length === 0) return null;
  return (
    // Inset like the composer card under it (`spacing-system-m`), so the two line up,
    // and the wall's distance to it as in the chat's empty state.
    <section aria-label="Quick actions" className="mb-[var(--spacing-system-mf)] px-[var(--spacing-system-m)]">
      <MingoQuickActionWall
        quickActions={chips}
        onQuickActionHover={action => {
          previewedRef.current = action.prompt ?? action.label;
          showPreview(previewedRef.current);
        }}
        onQuickActionHoverEnd={() => {
          if (previewedRef.current) hidePreview(previewedRef.current);
          previewedRef.current = null;
        }}
      />
    </section>
  );
}
