'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { getAgentAccent, QuickActionChipButton } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect } from 'react';
import { useComposerPreviewStore } from '@/app/components/mingo-shell/composer-preview-store';
import { useMingoQuickActions } from '../hooks/use-mingo-quick-actions';
import { useMingoChat } from '../providers/mingo-chat-provider';

/**
 * Mingo's quick actions on the home (MISSING 1.6): the ones AI Settings configures, else
 * the hub defaults — the same list and chips the chat's new-chat screen shows. A click
 * SENDS the action's instructions in a new chat; the dock then opens that chat. Hover or
 * focus previews the full instructions as ghost text in the docked composer, as the
 * chat's own chips do (the chip's short name does not say what it sends). Nothing renders
 * while there are none (the chat's welcome does the same).
 */
export function MingoHomeQuickActions() {
  const actions = useMingoQuickActions();
  // A reader, not a surface: the docked composer keeps the chat state running.
  const { chat } = useMingoChat();
  const sendInNewDialog = chat?.sendInNewDialog;
  const showPreview = useComposerPreviewStore(s => s.show);
  const hidePreview = useComposerPreviewStore(s => s.hide);
  const clearPreview = useComposerPreviewStore(s => s.clear);

  // The preview belongs to the chips on screen: leaving home (a click's chat page
  // included) must not leave it in the composer.
  useEffect(() => clearPreview, [clearPreview]);

  if (actions.length === 0) return null;

  return (
    <section aria-label="Quick actions">
      <TitleBlock title="Quick Actions" />
      <div className="flex flex-wrap gap-[var(--spacing-system-xs)]">
        {actions.map(action => (
          <QuickActionChipButton
            key={action.id}
            label={action.name}
            variant="outline"
            // Product Hub defaults carry a glyph (iconName/iconUrl/iconProps), tenant
            // customs the `iconName` picked in AI Settings; none → a text-only chip.
            icon={{
              name: action.iconName ?? undefined,
              url: action.iconUrl ?? undefined,
              props: action.iconProps ?? undefined,
              accent: getAgentAccent('mingo'),
            }}
            onHoverStart={() => showPreview(action.instructions)}
            onHoverEnd={() => hidePreview(action.instructions)}
            onSelect={
              sendInNewDialog
                ? () => {
                    clearPreview();
                    void sendInNewDialog(action.instructions);
                  }
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
