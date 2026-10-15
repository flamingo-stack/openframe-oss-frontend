'use client';

import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useShellRedirect, useShellVariant } from '@/app/hooks/use-shell-variant';
import { routes } from '@/lib/routes';
import { MingoArchivePlaceholder } from './mingo-archive-placeholder';

/**
 * Archived chats, a page of the Mingo-first shell. The classic shell keeps its archive
 * inside the chat drawer, so there this lands on the dashboard.
 */
export default function MingoArchivePage() {
  const variant = useShellVariant();
  useShellRedirect(variant === 'classic' ? routes.dashboard : null);

  if (variant !== 'mingo') return <CompactPageLoader />;
  return <MingoArchivePlaceholder />;
}
