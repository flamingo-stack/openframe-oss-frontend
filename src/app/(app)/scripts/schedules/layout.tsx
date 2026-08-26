'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { routes } from '@/lib/routes';

/**
 * Gates every `/scripts/schedules/*` route behind the `script-schedules` feature
 * flag. When the flag is off, direct navigation here redirects to the Scripts
 * list; the "Scripts Schedules" tab is hidden in the same case (see
 * `scripts-tabs.tsx`).
 *
 * The gate MUST distinguish "off" from "not answered yet". Read as a plain
 * boolean, unanswered is indistinguishable from off, so the redirect fires on
 * mount and a direct hit on `/scripts/schedules` bounces to the Scripts list —
 * for tenants that DO have the flag on. Re-evaluating later can't undo it: by
 * then the navigation has already happened. While unanswered, `children` render;
 * the page's own loading state is the right placeholder.
 */
export default function ScriptSchedulesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const gate = useFeatureFlagGate('script-schedules');

  useEffect(() => {
    if (gate === 'off') {
      router.replace(routes.scripts.list);
    }
  }, [gate, router]);

  if (gate === 'off') {
    return null;
  }

  return <>{children}</>;
}
