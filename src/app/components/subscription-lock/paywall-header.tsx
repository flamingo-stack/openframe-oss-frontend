'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { PaywallCopy } from './subscription-lock-copy';

interface PaywallHeaderProps {
  copy: PaywallCopy;
  /** Devices found in this instance — named in the description, see `PaywallCopy`. */
  detectedDevices: number | null;
}

/**
 * The plan picker's own heading. It REPLACES the page header rather than sitting
 * under one: this page is the paywall on every route that reaches it, and the
 * design carries no page chrome above it.
 *
 * The title comes from the subscription status, which the app shell has already
 * resolved, so it is there on the first paint. Only the line naming the device
 * count waits — hence the `null`.
 */
export function PaywallHeader({ copy, detectedDevices }: PaywallHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pt-6">
      <h1 className="text-h2 text-ods-text-primary">{copy.title}</h1>
      {detectedDevices != null ? (
        <p className="text-h6 text-ods-text-secondary">{copy.description(detectedDevices)}</p>
      ) : (
        <Skeleton className="h-5 w-[28rem] max-w-full" />
      )}
    </div>
  );
}
