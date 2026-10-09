'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useTourStarted } from '../lib/tour-start';

/**
 * Whether the setup wizard (`/setup`) is where this session belongs.
 *
 * - `unknown` - the flag or the progress has not answered; nothing moves yet.
 * - `setup`   - the workspace still owes its Initial Setup, or it is done and
 *               this user has not yet started the Mingo tour from the wizard's
 *               last screen.
 * - `none`    - the wizard is not for this session: flag off, setup and handoff
 *               both behind it, the tour finished or skipped, or no progress
 *               record at all (a failed fetch must not trap the user in a
 *               wizard that cannot save).
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
  if (user && !user.completed && !user.skipped && !tourStarted) return 'setup';
  return 'none';
}
