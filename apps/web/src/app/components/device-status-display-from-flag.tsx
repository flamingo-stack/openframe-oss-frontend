'use client';

import { DeviceStatusDisplayProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { ReactNode } from 'react';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';

/**
 * How every device view shows a device's status, from the `device-managed-status` flag: the lifecycle tag and the
 * connectivity icon when on, the look from before when off (`DeviceStatusDisplay`). Around the whole shell, so the
 * Mingo panel's pickers follow it too. Reads off until the flags answer; the page itself waits for them in
 * `DeviceStatusSupportGate`, so no page draws the wrong look first.
 */
export function DeviceStatusDisplayFromFlag({ children }: { children: ReactNode }) {
  const managedStatus = useFeatureFlag('device-managed-status');
  return (
    <DeviceStatusDisplayProvider display={managedStatus ? 'lifecycle' : 'legacy'}>
      {children}
    </DeviceStatusDisplayProvider>
  );
}
