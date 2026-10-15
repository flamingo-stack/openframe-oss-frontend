'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { getAgentAccent, QuickActionChipButton } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMingoQuickActions } from '../hooks/use-mingo-quick-actions';
import { useMingoChat } from '../providers/mingo-chat-provider';

/** Long enough that sweeping the pointer across the row doesn't flash every instruction. */
const PREVIEW_DELAY_MS = 300;

/**
 * Mingo's quick actions on the home (MISSING 1.6): the ones AI Settings configures, else
 * the hub defaults — the same list and chips the chat's new-chat screen shows. A click
 * SENDS the action's instructions in a new chat; the dock then opens that chat. Hover or
 * focus previews the full instructions, which the chip's short name does not say. Nothing
 * renders while there are none (the chat's welcome does the same).
 */
export function MingoHomeQuickActions() {
  const actions = useMingoQuickActions();
  // A reader, not a surface: the docked composer keeps the chat state running.
  const { chat } = useMingoChat();
  const sendInNewDialog = chat?.sendInNewDialog;

  if (actions.length === 0) return null;

  return (
    <section aria-label="Quick actions">
      <TitleBlock title="Quick Actions" />
      <TooltipProvider delayDuration={PREVIEW_DELAY_MS}>
        <div className="flex flex-wrap gap-[var(--spacing-system-xs)]">
          {actions.map(action => (
            <Tooltip key={action.id}>
              {/* The chip renders its own button and forwards no ref, so the trigger is a
                  wrapper; focus on the button bubbles to it. */}
              <TooltipTrigger asChild>
                <span className="inline-flex max-w-full">
                  <QuickActionChipButton
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
                    onSelect={sendInNewDialog ? () => void sendInNewDialog(action.instructions) : undefined}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm whitespace-pre-line">{action.instructions}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </section>
  );
}
