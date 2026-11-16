'use client';

import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components';
import { EndpointsRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { CONTENT_ENDPOINTS } from '@/app/(app)/help-center/endpoints';
import { shellKind } from '@/lib/platform';

/**
 * The platform announcement the hub admin publishes, in the `topBar` slot.
 * The lib bar self-fetches it through the `/content` proxy, animates in, and
 * remembers a dismissal per announcement id. `surface` is the shell this
 * bundle runs in, so an announcement the admin limited to other surfaces
 * stays collapsed here. `onExpandedChange` tells the layout whether it shows,
 * so the outdated-client bar can take the slot while it does not.
 */
export function AnnouncementTopBar({ onExpandedChange }: { onExpandedChange?: (expanded: boolean) => void }) {
  return (
    <EndpointsRuntimeContext.Provider value={CONTENT_ENDPOINTS}>
      <AnnouncementBar surface={shellKind()} onExpandedChange={onExpandedChange} />
    </EndpointsRuntimeContext.Provider>
  );
}
