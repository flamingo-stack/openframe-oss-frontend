'use client';

import {
  OnboardingCarousel,
  type OnboardingCarouselStep,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { PoweredByFlamingo } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ClockCheckIcon,
  MessagesIcon,
  UserCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { OpenFrameMark } from './openframe-mark';
import { previewAccentStyle } from './preview-accent';
import { ScaledPreviewFrame } from './scaled-preview-frame';

interface FaeWelcomePreviewProps {
  assistantName: string;
  avatarUrl?: string;
  accentColor: string;
  /** The last step's "Start Chat". The thumbnail is inert, so only the full preview passes it. */
  onComplete?: () => void;
  /** `thumbnail` scales the 1024×800 window into the card; `full` renders it 1:1. See `AiSettingsPreviews`. */
  variant?: 'thumbnail' | 'full';
}

/**
 * The Fae introduction (openframe-chat `OnboardingScreen`): the step cards the
 * client walks through on the first run and from "What to ask …?". Copy and
 * glyphs mirror the chat; the assistant's avatar heads the first card.
 */
export function FaeWelcomePreview({
  assistantName,
  avatarUrl,
  accentColor,
  onComplete,
  variant = 'thumbnail',
}: FaeWelcomePreviewProps) {
  const isThumbnail = variant === 'thumbnail';

  const steps: OnboardingCarouselStep[] = [
    {
      id: 'meet',
      icon: <SquareAvatar variant="round" sizePx={28} src={avatarUrl} alt={assistantName} fallback={assistantName} />,
      title: 'Meet Your AI IT Assistant',
      description: 'Fixes what it can right away,\nand hands off the rest to your technicians.',
    },
    {
      id: 'describe',
      icon: <MessagesIcon size={28} />,
      title: "Type what's going on.",
      description:
        "Your assistant troubleshoots first.\nAnything it can't solve goes to your technician with full context.",
    },
    {
      id: 'ticket',
      icon: <UserCheckIcon size={28} />,
      title: 'Need a human?',
      description: 'Skip the chat and create a ticket.\nIt goes straight to your technicians.',
    },
    {
      id: 'anytime',
      icon: <ClockCheckIcon size={28} />,
      title: 'Ask anything, anytime.',
      description: 'No hold music, no queue.\nJust immediate help.',
    },
  ];

  const screen = (
    <div
      style={previewAccentStyle(accentColor)}
      className={cn(
        'flex flex-col items-center gap-[calc(2*var(--spacing-system-xlf))] bg-ods-bg px-[calc(2*var(--spacing-system-xlf))] py-[var(--spacing-system-xl)]',
        // `min-h-full` so a pane too short for the cards scrolls instead of squeezing them.
        isThumbnail ? 'h-full w-full' : 'min-h-full w-full',
      )}
    >
      <OpenFrameMark />
      {/* The side cards run to the window edge, past the screen padding. A pane
          shorter than the 800px window would squeeze the cards to nothing (the
          carousel gives up height before its gaps do), so the full preview keeps
          them at their own height and scrolls instead. */}
      <div
        className={cn(
          '-mx-[calc(2*var(--spacing-system-xlf))] flex flex-1 self-stretch',
          isThumbnail ? 'min-h-0' : 'shrink-0',
        )}
      >
        <OnboardingCarousel steps={steps} onComplete={onComplete ?? (() => undefined)} />
      </div>
      <PoweredByFlamingo />
    </div>
  );

  if (!isThumbnail) return <div className="flex h-full w-full flex-col overflow-y-auto">{screen}</div>;

  return <ScaledPreviewFrame>{screen}</ScaledPreviewFrame>;
}
