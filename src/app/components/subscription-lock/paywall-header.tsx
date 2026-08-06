'use client';

import type { PaywallCopy } from './subscription-lock-copy';

interface PaywallHeaderProps {
  copy: PaywallCopy;
  /** Active devices, once billing has counted them. `null` until then. */
  deviceCount?: number | null;
}

/**
 * The plan picker's own heading. It REPLACES the page header rather than sitting
 * under one: this page is the paywall on every route that reaches it, and the
 * design carries no page chrome above it.
 *
 * The title comes from the subscription status, which the app shell has already
 * resolved, so it is complete on the first paint. The second line names the
 * fleet the plan is for once billing has counted it, and states the same thing
 * without a number until then — it is one sentence either way, not a number
 * appearing into a gap left for it.
 */
export function PaywallHeader({ copy, deviceCount = null }: PaywallHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pt-6">
      <h1 className="text-h2 text-ods-text-primary">{copy.title}</h1>
      <p className="text-h6 text-ods-text-secondary">
        {deviceCount == null
          ? copy.description
          : `We've detected ${deviceCount.toLocaleString('en-US')} active device${deviceCount === 1 ? '' : 's'} in your OpenFrame instance that ${deviceCount === 1 ? 'requires' : 'require'} a subscription to continue management.`}
      </p>
    </div>
  );
}
