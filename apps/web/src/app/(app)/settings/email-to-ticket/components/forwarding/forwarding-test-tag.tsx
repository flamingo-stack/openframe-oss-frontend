'use client';

import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DotsLoaderIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { type ForwardingTestTone, forwardingTestTag } from '../../utils/forwarding-test-presentation';

const TONE_VARIANT = { waiting: 'warning', success: 'success', error: 'error' } as const satisfies Record<
  ForwardingTestTone,
  string
>;

const TONE_ICON: Record<ForwardingTestTone, ReactNode> = {
  waiting: <DotsLoaderIcon size={16} />,
  success: <CheckCircleIcon size={16} />,
  error: <AlertTriangleIcon size={16} />,
};

/** The run's tag beside the test button (Figma settings 6236-120421, 6236-120460, 6236-120500); none before a run. */
export function ForwardingTestTag({ state }: { state: string }) {
  const tag = forwardingTestTag(state);
  if (!tag) return null;
  return (
    <Tag size="compact" variant={TONE_VARIANT[tag.tone]} icon={TONE_ICON[tag.tone]} label={tag.label} role="status" />
  );
}
