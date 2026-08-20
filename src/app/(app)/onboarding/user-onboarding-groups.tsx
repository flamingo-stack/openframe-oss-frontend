import {
  BookBookmarkIcon,
  BracketCurlyIcon,
  ClipboardListIcon,
  RadarIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';
import { UserOnboardingStep } from '@/generated/schema-enums';
import { MEET_MINGO_META } from './meet-mingo-meta';
import type { UserOnboardingStepId } from './onboarding-steps';

/**
 * Static presentation metadata for the user "Get Started" onboarding steps —
 * everything that is known WITHOUT the backend: the group a step belongs to, its
 * icon, title and description. Only a step's completion status comes from the
 * request.
 *
 * Single source of truth shared by {@link ./components/onboarding-content} (the
 * live page) and {@link ./components/onboarding-skeleton} (the loading state), so
 * the two never drift and the skeleton can show every static label.
 */
export interface UserStepMeta {
  /** Narrowed to the tour's own steps, so a group can't list one the canonical
   *  order array in {@link ./onboarding-steps} doesn't render. */
  step: UserOnboardingStepId;
  icon: ReactNode;
  title: string;
  description: string;
}

export interface UserGroupMeta {
  label: string;
  items: UserStepMeta[];
}

export const USER_ONBOARDING_GROUPS: UserGroupMeta[] = [
  {
    label: 'Work smarter with AI',
    items: [
      {
        step: UserOnboardingStep.MEET_MINGO,
        // Shared with the tenant Initial Setup card — same step, same row.
        ...MEET_MINGO_META,
      },
      {
        step: UserOnboardingStep.TICKETS,
        icon: <TagIcon size={24} />,
        title: 'Tickets',
        description:
          'Every client chat is a ticket. AI Assistant resolves them automatically - or your team steps in when needed.',
      },
    ],
  },
  {
    label: 'Run your operations',
    items: [
      {
        step: UserOnboardingStep.SCRIPTING,
        icon: <BracketCurlyIcon size={24} />,
        title: 'Scripting',
        description: 'Automate routine tasks with scripts you run across devices on demand or on schedule.',
      },
      {
        step: UserOnboardingStep.MONITORING,
        icon: <RadarIcon size={24} />,
        title: 'Monitoring',
        description: 'Track device health, alerts, and performance across every client in real time.',
      },
      {
        step: UserOnboardingStep.LOGGING,
        icon: <ClipboardListIcon size={24} />,
        title: 'Logging',
        description: 'See a full activity trail of what happened, when, and who did it.',
      },
      {
        step: UserOnboardingStep.KNOWLEDGE_MANAGEMENT,
        icon: <BookBookmarkIcon size={24} />,
        title: 'Knowledge Management',
        description: 'Build a knowledge base your AI agents use to answer clients and resolve tickets.',
      },
    ],
  },
];
