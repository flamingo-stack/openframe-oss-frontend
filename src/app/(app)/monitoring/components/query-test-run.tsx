'use client';

import { useTestRunState } from '@flamingo-stack/openframe-frontend-core';
import { useCallback } from 'react';
import { useLiveCampaign } from '../hooks/use-live-campaign';

/**
 * Fleet-flavored wrapper over the core lib's test-run state machine: binds
 * `useTestRunState` (run/stop/reset flow, duration ticking, display flags)
 * to this app's Fleet live-campaign transport. The UI building blocks
 * (TimingStat, TestRunResults, TestResultsSkeleton/Table) come from the lib.
 */
export function useQueryTestRun() {
  const campaign = useLiveCampaign();
  const test = useTestRunState(campaign);

  const { run: runStart } = test;
  const run = useCallback(
    (query: string, hostIds: number[]) => runStart(() => campaign.startCampaign(query, hostIds)),
    [runStart, campaign],
  );

  return { ...test, run };
}
