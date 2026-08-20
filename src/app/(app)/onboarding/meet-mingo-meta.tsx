'use client';

/**
 * Icon + copy for the "Meet Mingo" row, in ONE place because it is the same step
 * on two surfaces: the tenant Initial Setup card on the dashboard and the user
 * "Get Started" tour. The design shows it in both, and two hand-kept copies of a
 * title and a sentence are how those two drift.
 *
 * The step BODY is shared the same way — `./components/mingo-step`.
 */

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import type { ReactNode } from 'react';

export const MEET_MINGO_META: { icon: ReactNode; title: string; description: string } = {
  icon: (
    <MingoIcon
      className="size-6"
      color="var(--color-text-secondary)"
      eyesColor="var(--ods-flamingo-cyan-base)"
      cornerColor="var(--ods-flamingo-cyan-base)"
    />
  ),
  title: 'Meet Mingo',
  description: 'Your AI co-pilot for the OpenFrame workspace. Ask questions, get summaries, or delegate tasks.',
};
