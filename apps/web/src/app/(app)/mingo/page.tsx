'use client';

import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useShellRedirect, useShellVariant } from '@/app/hooks/use-shell-variant';
import { routes } from '@/lib/routes';
import { MingoHome } from './home/mingo-home';

/**
 * Mingo's home: the landing page of the Mingo-first shell. In the classic shell it
 * is the dashboard, query and fragment kept (a `?mingoDialog=` rides along to the
 * drawer there). While the variant is unanswered it decides nothing.
 */
export default function MingoHomePage() {
  const variant = useShellVariant();
  useShellRedirect(variant === 'classic' ? routes.dashboard : null, { carryLocation: true });

  if (variant !== 'mingo') return <CompactPageLoader />;
  return <MingoHome />;
}
