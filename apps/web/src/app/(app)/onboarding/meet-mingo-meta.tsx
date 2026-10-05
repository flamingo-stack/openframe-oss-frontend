'use client';

/**
 * Icon + copy for the "Meet Mingo" row — one definition for both surfaces that
 * render it (the Initial Setup card and the "Get Started" tour), so they can't
 * drift. The step body is shared the same way: `./components/mingo-step`.
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
