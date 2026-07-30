'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { routes } from '@/lib/routes';

/**
 * Gates every `/scripts-v2/schedules/*` route behind the `script-schedules`
 * feature flag — a sub-gate nested inside the `scripts-v2` gate one level up (see
 * `../layout.tsx`). When the flag is off, direct navigation here redirects to the
 * Scripts list; the "Scripts Schedules" tab is hidden in the same case (see
 * `scripts-v2-tabs.tsx`).
 *
 * Same three-state read as the parent gate and the tab bar, for the same reason:
 * treating "not answered yet" as "off" redirected away from a route the tenant
 * does have. See `../layout.tsx`.
 */
export default function ScriptSchedulesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const gate = useFeatureFlagGate('script-schedules');

  useEffect(() => {
    if (gate === 'off') {
      router.replace(routes.scriptsV2.list);
    }
  }, [gate, router]);

  if (gate === 'off') {
    return null;
  }

  return <>{children}</>;
}
