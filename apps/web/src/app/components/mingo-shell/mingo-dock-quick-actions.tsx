'use client';

import { MingoQuickActionWall } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { QuestionCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useRef } from 'react';
import { useComposerPreviewStore } from './composer-preview-store';
import { useMingoQuickActionChips } from './use-mingo-quick-action-chips';

interface MingoDockQuickActionsProps {
  /** Sends an action's instructions in a new chat (the dock's own send, which then opens it). */
  onSend: (instructions: string) => void;
  /** "What to ask Mingo?": the suggestions the chat starts from. */
  onWhatToAsk: () => void;
}

/**
 * Mingo's quick actions above the docked composer on the home (FE_PROMPT §3.7, MISSING
 * 1.6): the chat's own quick-action wall (`MingoQuickActionWall`, what the classic chat's
 * empty state drew), under a "Quick actions" caption with "What to ask Mingo?" at its
 * end, as the design places them. A click SENDS the action's instructions in a new chat;
 * hover or focus previews them as ghost text in the composer (the chip's short name does
 * not say what it sends). With no actions the caption row stays, for "What to ask Mingo?".
 */
export function MingoDockQuickActions({ onSend, onWhatToAsk }: MingoDockQuickActionsProps) {
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

  return (
    // Inset like the composer card under it (`spacing-system-m`), so the two line up,
    // and the wall's distance to it as in the chat's empty state.
    <section
      aria-label="Quick actions"
      className="mb-[var(--spacing-system-mf)] flex flex-col gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-m)]"
    >
      <div className="flex items-center justify-between gap-[var(--spacing-system-sf)]">
        <h2 className="text-ods-text-secondary text-h5">Quick actions</h2>
        {/* The caption's grey, the label and its icon; brighter on hover. */}
        <Button
          variant="transparent"
          size="compact"
          leftIcon={<QuestionCircleIcon />}
          onClick={onWhatToAsk}
          className="text-ods-text-secondary hover:text-ods-text-primary"
        >
          What to ask Mingo?
        </Button>
      </div>
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
