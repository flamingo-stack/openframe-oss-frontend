import { SubscriptionStatus } from '@/generated/schema-enums';

/**
 * Copy for the viewer who cannot fix the lock themselves. Split by status because
 * "your trial ended" and "your subscription ended" are different facts, and the
 * one thing both need to say is who to go to.
 *
 * Its own module because both lazily-loaded lock screens (the web paywall and the
 * desktop read-only lock) need it, and neither may import the other. Imported
 * only from those two, so this wording stays out of the mobile bundles along
 * with the rest of the subscription vocabulary.
 */
export function noAccessCopy(status: SubscriptionStatus): { title: string; description: string } {
  const description =
    'Only the workspace owner or an admin can restore it. Contact one of them to bring the workspace back for your team.';

  if (status === SubscriptionStatus.TRIAL_EXPIRED) {
    return { title: 'The free trial has ended.', description };
  }
  // Deliberately names no invoice and no amount: what this viewer can do about
  // it is identical either way, and a member has no business reading the
  // workspace's balance off a screen they cannot pay from.
  if (status === SubscriptionStatus.SUSPENDED) {
    return { title: 'This workspace has been suspended.', description };
  }
  return { title: 'The subscription has ended.', description };
}
