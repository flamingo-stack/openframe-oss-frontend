'use client';

import { LoadingParagraph, type ParagraphLines } from '../shared/loading-paragraph';
import { LockScreenActionsMenu } from './lock-screen-actions';
import { type PaywallCopy, paywallDescription } from './subscription-lock-copy';

interface PaywallHeaderProps {
  copy: PaywallCopy;
  /** Active devices, once billing has counted them. `null` until then. */
  deviceCount?: number | null;
  /** Billing is still being read. A loading scope does the same. */
  loading?: boolean;
}

/**
 * The fleet sentence's typical lines (about 120 characters of h6, ~840px): two in the activate-subscription modal and on
 * a phone, one on the full-width page from `content-md` (an estimate from the copy's length, not measured).
 */
const MODAL_DESCRIPTION_LINES = 2;
const PAGE_DESCRIPTION_LINES: ParagraphLines = { base: 2, md: 1 };

/**
 * The paywall's second line: the fleet the plan is for. While billing is read it is the sentence's typical lines,
 * never the generic sentence; shared by this header and the activate-subscription modal.
 */
export function PaywallDescription({
  copy,
  deviceCount = null,
  loading,
  lines = MODAL_DESCRIPTION_LINES,
}: PaywallHeaderProps & { lines?: ParagraphLines }) {
  return <LoadingParagraph loading={loading} text={paywallDescription(copy, deviceCount)} type="h6" lines={lines} />;
}

/**
 * The plan picker's own heading. It REPLACES the page header rather than sitting
 * under one: this page is the paywall on every route that reaches it, and the
 * design carries no page chrome above it.
 *
 * The title comes from the subscription status, which the app shell has already
 * resolved, so it is complete on the first paint. The second line names the
 * fleet the plan is for once billing has counted it (`PaywallDescription`).
 *
 * The "…" menu on the title row is this screen's copy of the exits the other
 * lock screens spell out as a button row (`LockScreenActionsMenu`). It sits
 * where every other page in the app puts its header actions, which is also the
 * only place on THIS page that does not compete with "Proceed to Payment".
 * Rendered unconditionally: none of the three depends on billing data, so they
 * are there while the prices are still loading — which is exactly when a user
 * who cannot pay wants them.
 */
export function PaywallHeader({ copy, deviceCount = null, loading }: PaywallHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pt-6">
      <div className="flex items-start justify-between gap-[var(--spacing-system-mf)]">
        <h1 className="text-ods-text-primary text-h2">{copy.title}</h1>
        <LockScreenActionsMenu triggerClassName="shrink-0" />
      </div>
      <PaywallDescription copy={copy} deviceCount={deviceCount} loading={loading} lines={PAGE_DESCRIPTION_LINES} />
    </div>
  );
}
