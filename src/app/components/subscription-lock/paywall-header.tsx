'use client';

import type { PaywallCopy } from './subscription-lock-copy';

interface PaywallHeaderProps {
  copy: PaywallCopy;
}

/**
 * The plan picker's own heading. It REPLACES the page header rather than sitting
 * under one: this page is the paywall on every route that reaches it, and the
 * design carries no page chrome above it.
 *
 * Both lines come from the subscription status, which the app shell has already
 * resolved, so the header is complete on the first paint — nothing here waits on
 * a request (see `PaywallCopy` for why the device count no longer appears).
 */
export function PaywallHeader({ copy }: PaywallHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pt-6">
      <h1 className="text-h2 text-ods-text-primary">{copy.title}</h1>
      <p className="text-h6 text-ods-text-secondary">{copy.description}</p>
    </div>
  );
}
