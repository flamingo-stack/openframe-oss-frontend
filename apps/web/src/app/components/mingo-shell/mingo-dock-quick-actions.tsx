'use client';

import { getAgentAccent, QuickActionChipButton } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ActionsMenuDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useAutoLimitTags } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect } from 'react';
import { useMingoQuickActions } from '@/app/(app)/mingo/hooks/use-mingo-quick-actions';
import type { AiQuickAction } from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { useComposerPreviewStore } from './composer-preview-store';

/** A chip's icon: Product Hub defaults carry a glyph, tenant customs the `iconName` picked in AI Settings. */
function chipIcon(action: AiQuickAction) {
  return {
    name: action.iconName ?? undefined,
    url: action.iconUrl ?? undefined,
    props: action.iconProps ?? undefined,
    accent: getAgentAccent('mingo'),
  };
}

interface MingoDockQuickActionsProps {
  /** Sends an action's instructions in a new chat (the dock's own send, which then opens it). */
  onSend: (instructions: string) => void;
}

/**
 * Mingo's quick actions above the docked composer on the home (FE_PROMPT §3.7, MISSING
 * 1.6): the ones AI Settings configures, else the hub defaults, as one row of the chat's
 * own chips — as many as fit, the rest behind a "+N" menu. A click SENDS the action's
 * instructions in a new chat; hover or focus previews them as ghost text in the composer
 * (the chip's short name does not say what it sends). Nothing renders while there are none.
 */
export function MingoDockQuickActions({ onSend }: MingoDockQuickActionsProps) {
  const actions = useMingoQuickActions();
  const showPreview = useComposerPreviewStore(s => s.show);
  const hidePreview = useComposerPreviewStore(s => s.hide);
  const clearPreview = useComposerPreviewStore(s => s.clear);
  const { visibleCount, middleRef, measureRef, badgeRef } = useAutoLimitTags({
    count: actions.length,
    reserveInputWidth: false,
  });

  // The preview belongs to the chips on screen: leaving home (a click's chat page
  // included) must not leave it in the composer.
  useEffect(() => clearPreview, [clearPreview]);

  if (actions.length === 0) return null;

  const send = (action: AiQuickAction) => {
    clearPreview();
    onSend(action.instructions);
  };
  const hidden = actions.slice(visibleCount);

  return (
    // Inset like the composer card under it (`spacing-system-m`), so the two line up.
    <div className="relative mb-[var(--spacing-system-xsf)] px-[var(--spacing-system-m)]">
      <div
        ref={middleRef}
        role="group"
        aria-label="Quick actions"
        className="flex min-w-0 gap-[var(--spacing-system-xs)] overflow-hidden"
      >
        {actions.slice(0, visibleCount).map(action => (
          <QuickActionChipButton
            key={action.id}
            label={action.name}
            variant="outline"
            icon={chipIcon(action)}
            onHoverStart={() => showPreview(action.instructions)}
            onHoverEnd={() => hidePreview(action.instructions)}
            onSelect={() => send(action)}
          />
        ))}
        {hidden.length > 0 && (
          <ActionsMenuDropdown
            triggerAriaLabel={`${hidden.length} more quick actions`}
            side="top"
            align="end"
            groups={[
              { items: hidden.map(action => ({ id: action.id, label: action.name, onClick: () => send(action) })) },
            ]}
            customTrigger={
              <button
                type="button"
                aria-label={`${hidden.length} more quick actions`}
                className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
              >
                <QuickActionChipButton interactive={false} label={`+${hidden.length}`} />
              </button>
            }
          />
        )}
      </div>
      {/* Off-screen copies the row measures to decide how many chips fit. */}
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden">
        <div ref={measureRef} className="flex w-max gap-[var(--spacing-system-xs)]">
          {actions.map(action => (
            <QuickActionChipButton key={action.id} interactive={false} label={action.name} icon={chipIcon(action)} />
          ))}
        </div>
        <button ref={badgeRef} type="button" tabIndex={-1} className="shrink-0">
          <QuickActionChipButton interactive={false} label={`+${actions.length}`} />
        </button>
      </div>
    </div>
  );
}
