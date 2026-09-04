'use client';

import {
  accentFromIdentityIcon,
  getAgentAccent,
  type QuickActionChip,
  QuickActionWall,
  useEmptyStateConfig,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { Video } from '@flamingo-stack/openframe-frontend-core/components/features';
import { CheckCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';

const GUARDRAILS_HREF = '/settings/ai-settings?tab=guardrails';

// Placeholder demo clip until the real onboarding videos are ready.
const DEMO_VIDEO_ID = 'i4H_XqrI3RA';

/**
 * Inner body of the "Meet Mingo" onboarding step.
 *
 * The quick-action chips come from the Mingo AGENT's published config, not the platform
 * empty-state: both share MPH's `resolveChatSurfaceDisplay`, but the empty-state is keyed
 * by deployment platform and would return the platform's own chips. Selected through the
 * runtime's `aiAgentConfigUrl(slug)` seam and rendered through the same `QuickActionWall`
 * as the chat empty state, so the glyphs match the chat exactly.
 *
 * The public agent slug is `mingo` (its chat-admin `source` is `agent-mingo`).
 */
const MINGO_AGENT_SLUG = 'mingo';

/**
 * Wall geometry. `QuickActionWall` deals the chips out round-robin (`i % rows`) and pads
 * each course with repeats, so the row count must stay BELOW
 * `chips / MIN_UNIQUE_CHIPS_PER_ROW` — at one chip per row every course scrolls the same
 * action repeated across the whole strip. Derived from the supply rather than hardcoded:
 * the hub's action list is admin-edited and can shrink at any time.
 *
 * Deliberately NOT `agentSlug={MINGO_AGENT_SLUG}`: a built-in agent slug caps the stack at
 * the lib's `AGENT_MAX_ROWS` (2), which is right above the chat composer but leaves this
 * card's left column half empty next to the demo video.
 */
const MAX_WALL_ROWS = 4;
const MIN_UNIQUE_CHIPS_PER_ROW = 7;

export function MingoStep({
  onComplete,
  onCompleteBackground,
  completed,
  completing,
}: {
  onComplete?: () => void;
  onCompleteBackground?: () => void;
  completed?: boolean;
  completing?: boolean;
}) {
  // MPH-sourced quick actions — the `agent-mingo` agent config (source-keyed on
  // `agent-mingo`), selected via the runtime's standard agent-config URL builder.
  const runtime = useChatRuntime();
  const agentConfigUrl = runtime?.endpoints.aiAgentConfigUrl?.(MINGO_AGENT_SLUG);
  const { config } = useEmptyStateConfig(agentConfigUrl, { enabled: Boolean(agentConfigUrl) });

  const startNewChat = useCallback(() => {
    // NOT just "open the drawer": with no conversation open the narrow panel
    // shows its "Current Chats" list, so a plain open landed the visitor on a
    // chat picker (usually empty) instead of the chat this button promises.
    // `startNewChat` clears the active dialog AND puts the panel on the
    // composer, where the same quick actions are wired to actually send.
    useMingoLauncherStore.getState().startNewChat();
  }, []);

  // Accent resolved admin-first: per-action color → the agent identity's
  // `icon_props.color` → the `mingo` fallback. Clicking a chip opens the drawer and
  // sends that action's prompt via the launcher's one-shot `sendToMingo`.
  const chips = useMemo<QuickActionChip[]>(() => {
    const accent = accentFromIdentityIcon(config.icon) ?? getAgentAccent(MINGO_AGENT_SLUG);
    return config.quickActions.map(action => ({
      id: action.id,
      label: action.label,
      icon: {
        name: action.iconName ?? undefined,
        url: action.iconUrl ?? undefined,
        props: action.iconProps ?? undefined,
        accent,
      },
      onSelect: () => useMingoLauncherStore.getState().sendToMingo(action.prompt),
    }));
  }, [config.quickActions, config.icon]);

  const wallRows = Math.min(MAX_WALL_ROWS, Math.max(1, Math.floor(chips.length / MIN_UNIQUE_CHIPS_PER_ROW)));

  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-l)]">
      {/* Intro + quick actions (left) / demo video (right) */}
      <div className="flex w-full flex-col items-start gap-[var(--spacing-system-l)] md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-l)]">
          <p className="text-ods-text-primary text-h4">
            Mingo knows your entire OpenFrame workspace - devices, tickets, Customers, team. Mingo can both answer and
            act. What it&apos;s allowed to do on its own is controlled by your{' '}
            <Link href={GUARDRAILS_HREF} className="text-ods-accent underline">
              Guardrail Settings
            </Link>
            .
          </p>

          {chips.length > 0 && (
            <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <p className="text-ods-text-secondary text-h5">Try this quick actions:</p>
              <QuickActionWall
                chips={chips}
                rows={wallRows}
                pauseOnHover
                dragScroll
                fade={['left', 'right']}
                fadeSize={{ left: 32 }}
                fadeColor="var(--color-bg)"
                copyGap="var(--spacing-system-xxs)"
                className="max-h-44 shrink-0"
              />
            </div>
          )}
        </div>

        <div className="w-full flex-1">
          <Video kind="youtube" url={DEMO_VIDEO_ID} title="Meet Mingo demo video" priority />
        </div>
      </div>

      {/* Footer actions — right column mirrors the intro/video split above so the
          buttons line up flush with the demo video block. */}
      <div className="flex w-full flex-col gap-[var(--spacing-system-l)] md:flex-row">
        <div className="hidden flex-1 md:block" />
        <div className="flex w-full flex-1 flex-col gap-[var(--spacing-system-m)] md:flex-row md:items-center">
          {!completed ? (
            <Button
              variant="outline"
              leftIcon={<CheckCircleIcon className="size-5" />}
              onClick={() => onComplete?.()}
              loading={completing}
              disabled={completing}
              className="w-full md:flex-1"
            >
              Mark as Complete
            </Button>
          ) : (
            // Keep the completed step's primary button its own width — don't let it
            // stretch into the removed "Mark as Complete" slot.
            <div className="hidden md:block md:flex-1" aria-hidden />
          )}
          <Button
            variant="accent"
            onClick={() => {
              // Opening a chat completes the step in the background — no spinner, the
              // drawer opening is the feedback.
              if (!completed) onCompleteBackground?.();
              startNewChat();
            }}
            className="w-full md:flex-1"
          >
            Start New Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
