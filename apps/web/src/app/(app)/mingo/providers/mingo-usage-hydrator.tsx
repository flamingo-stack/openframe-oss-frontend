'use client';

import { useEffect } from 'react';
import { fetchQuery, graphql, useRelayEnvironment } from 'react-relay';
import type { mingoUsageHydratorQuery as MingoUsageHydratorQueryType } from '@/__generated__/mingoUsageHydratorQuery.graphql';
import { useAiBalanceLowTokens } from '@/app/hooks/use-ai-balance-low-tokens';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import { sessionPollsAllowed } from '@/lib/session-poll';
import { companyUsageOf } from '../hooks/mingo-usage-panel-data';
import { useMingoUsageStore } from '../stores/mingo-usage-store';

/** The company figures may be a minute behind (the backend refreshes them once a minute): read them as often. */
export const MINGO_USAGE_REFRESH_MS = 60_000;

const mingoUsageHydratorQuery = graphql`
  query mingoUsageHydratorQuery($list: Boolean!) {
    subscription @include(if: $list) {
      # Identifies the record, so the billing page's fresher answer reaches the panel too.
      id
      status
      usage {
        aiTokensFree
        aiTokensFreeUsed
        purchasedTokensRemaining
        purchasedTokensRemainingUsd
      }
    }
  }
`;

/**
 * Reads the company rows of Mingo's Usage panel (the free grant, the prepaid balance and its colour) into
 * `useMingoUsageStore`: on mount, and every minute while a chat is on screen. Draws nothing.
 */
export function MingoUsageHydrator({ onScreen }: { onScreen: boolean }) {
  const environment = useRelayEnvironment();
  const lowTokens = useAiBalanceLowTokens();
  const setCompany = useMingoUsageStore(s => s.setCompany);
  const { data, isLoading } = useNonSuspendingQuery<MingoUsageHydratorQueryType>(mingoUsageHydratorQuery, {
    list: true,
  });
  const subscription = data.subscription;

  useEffect(() => {
    setCompany(companyUsageOf(subscription, lowTokens, isLoading));
  }, [subscription, lowTokens, isLoading, setCompany]);

  useEffect(() => {
    if (!onScreen) return undefined;
    const timer = setInterval(() => {
      if (!sessionPollsAllowed()) return;
      // Into the store; the read above follows it. A failed refresh keeps the last answer.
      fetchQuery<MingoUsageHydratorQueryType>(
        environment,
        mingoUsageHydratorQuery,
        { list: true },
        { fetchPolicy: 'network-only' },
      ).subscribe({ error: () => undefined });
    }, MINGO_USAGE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [environment, onScreen]);

  return null;
}
