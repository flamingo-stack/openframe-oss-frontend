'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useBillingAccessGate } from '@/app/hooks/use-billing-access-gate';
import { openBillingInBrowser } from '@/lib/billing-visibility';
import { noAccessCopy } from './no-access-copy';
import { useSubscriptionLock } from './subscription-guard';
import { WorkspaceInactiveScreen } from './workspace-inactive-screen';

/**
 * The lock screen on the desktop build, where billing is read-only (see
 * `billing-visibility.ts`): no plan picker and no invoice list to pay from, but
 * not a dead end either — whoever may open billing gets the one exit to the web
 * app, where the workspace can actually be restored, and "Check Again" to come
 * back through.
 *
 * Role-shaped the same way the web lock is: the button would only hand a member
 * to a page that refuses them, so they get the "contact the owner" copy instead.
 * Default export: `next/dynamic` entry point.
 */
export default function ReadOnlyLockContent() {
  const access = useBillingAccessGate();
  const { status } = useSubscriptionLock();
  const copy = noAccessCopy(status);

  if (access === 'denied') {
    return <WorkspaceInactiveScreen {...copy} />;
  }

  // Waiting on the role shows the fact and neither remedy: the refusal is wrong
  // for an owner, and the button is wrong for a member.
  if (access === 'loading') {
    return <WorkspaceInactiveScreen title={copy.title} description="Checking your access…" />;
  }

  return (
    <WorkspaceInactiveScreen
      title={copy.title}
      description="Billing is managed in the browser. Open it to restore the workspace, then check again here."
      action={
        <Button variant="accent" leftIcon={<ExternalLinkIcon />} onClick={openBillingInBrowser}>
          Manage Billing
        </Button>
      }
    />
  );
}
