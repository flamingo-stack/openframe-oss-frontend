'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { routes } from '@/lib/routes';

/**
 * Gates every `/scripts-v2/*` route behind the `scripts-v2` feature flag. When the
 * flag is off, direct navigation here redirects to the stable `/scripts` page.
 *
 * The gate MUST distinguish "off" from "not answered yet". Reading the flag as a
 * plain boolean made unanswered indistinguishable from off, so the redirect fired
 * on mount and refreshing `/scripts-v2` bounced to legacy `/scripts` — for tenants
 * that have the flag on. Re-evaluating later can't undo it: by then the navigation
 * has already happened.
 *
 * While unanswered, `children` render. The page's own loading state is the right
 * placeholder — an access gate has no business inventing a second one — and if the
 * answer turns out to be "off", the redirect below runs then.
 */
export default function ScriptsV2Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const gate = useFeatureFlagGate('scripts-v2');

  useEffect(() => {
    if (gate === 'off') {
      router.replace(routes.scripts.list());
    }
  }, [gate, router]);

  if (gate === 'off') {
    return null;
  }

  return <>{children}</>;
}
