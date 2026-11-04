'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useTourStarted } from '../lib/tour-state';

/**
 * Whether the setup wizard (`/setup`) is where this session belongs.
 *
 * - `unknown` - the flag or the progress has not answered; nothing moves yet.
 * - `setup`   - the workspace still owes its Initial Setup, or it is done and
 *               this user has not yet been through the wizard's last screen:
 *               the server has not recorded it as seen and knows no tour
 *               conversation, and this device has not just pressed "Start with
 *               Mingo".
 * - `none`    - the wizard is not for this session: flag off, setup done and
 *               its last screen seen (or the tour started, finished or
 *               skipped), or no progress record at all (a failed fetch must
 *               not trap the user in a wizard that cannot save).
 *
 * The server's `setupSeen` is the lasting record: the local handoff marker only
 * bridges the moment after "Start with Mingo", before the server has answered,
 * and `tourDialogId` covers the records from before the flag existed.
 */
export type SetupPending = 'unknown' | 'setup' | 'none';

export function useSetupPending(): SetupPending {
  const gate = useFeatureFlagGate('onboarding-v2');
  const isLoaded = useOnboardingStore(state => state.isLoaded);
  const tenant = useOnboardingStore(state => state.tenant);
  const user = useOnboardingStore(state => state.user);
  const tourStarted = useTourStarted();

  if (gate === 'loading' || !isLoaded) return 'unknown';
  if (gate === 'off' || !tenant) return 'none';
  if (!tenant.completed) return 'setup';
  if (user && !user.completed && !user.skipped && !user.setupSeen && user.tourDialogId === null && !tourStarted) {
    return 'setup';
  }
  return 'none';
}
