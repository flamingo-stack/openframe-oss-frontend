'use client';

import type { WhatToAskContent } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useCallback } from 'react';
import { fetchQuery, useRelayEnvironment } from 'react-relay';
import type { whatToAskDevicesRelayQuery as WhatToAskDevicesQueryType } from '@/__generated__/whatToAskDevicesRelayQuery.graphql';
import { whatToAskDevicesRelayQuery } from '@/graphql/devices/what-to-ask-devices-relay';
import { buildMingoWhatToAsk } from '../what-to-ask';

/** Enough to find a workstation, a server and a Windows device among them. */
const DEVICES_LOOKED_AT = 20;

/**
 * The "What to ask Mingo?" answer for the panel's `whatToAsk`: the workspace's
 * online devices, read fresh on each click (so a name is one online now), go
 * into the prompts. Never rejects: a failed read gives the prompts without names.
 */
export function useMingoWhatToAsk(): () => Promise<WhatToAskContent> {
  const environment = useRelayEnvironment();
  return useCallback(async () => {
    try {
      const data = await fetchQuery<WhatToAskDevicesQueryType>(
        environment,
        whatToAskDevicesRelayQuery,
        { first: DEVICES_LOOKED_AT },
        { fetchPolicy: 'network-only' },
      ).toPromise();
      return buildMingoWhatToAsk((data?.devices.edges ?? []).map(edge => edge.node));
    } catch (err) {
      console.error('[Mingo] online devices for "What to ask" failed:', err);
      return buildMingoWhatToAsk([]);
    }
  }, [environment]);
}
