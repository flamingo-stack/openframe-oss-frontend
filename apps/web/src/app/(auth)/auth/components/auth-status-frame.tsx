'use client';

import type { ReactNode } from 'react';
import { OpenframeLockup } from '@/app/components/shared/openframe-lockup';
import { PoweredByFlamingo } from '@/app/components/shared/powered-by-flamingo';

/**
 * The frame of the standalone auth status pages (`/auth/error`, `/auth/verify`): the logo on top, the page's content
 * centered, "Powered by Flamingo" at the foot.
 */
export function AuthStatusFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-ods-bg p-10">
      <OpenframeLockup />

      {children}

      <PoweredByFlamingo />
    </div>
  );
}
