'use client';

import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components';
import { EndpointsRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { useActiveAnnouncement } from '@/app/hooks/use-active-announcement';
import { shellKind } from '@/lib/platform';

/**
 * The platform announcement the hub admin publishes, in the `topBar` slot.
 *
 * The app fetches it (`useActiveAnnouncement`, which also keeps the last answer on the device) and hands it to the
 * lib bar as `initialAnnouncement`, always defined: the bar then draws it in its first frame and never fetches it
 * itself. The endpoints context is emptied for the same reason: an endpoints provider above the shell would make
 * the bar fetch again. The bar remembers a dismissal per announcement id. `surface` is the shell this bundle runs
 * in, so an announcement the admin limited to other surfaces stays collapsed here. `onExpandedChange` tells the
 * layout whether it shows, so the outdated-client bar can take the slot while it does not.
 */
export function AnnouncementTopBar({ onExpandedChange }: { onExpandedChange?: (expanded: boolean) => void }) {
  const announcement = useActiveAnnouncement();
  return (
    <EndpointsRuntimeContext.Provider value={null}>
      <AnnouncementBar initialAnnouncement={announcement} surface={shellKind()} onExpandedChange={onExpandedChange} />
    </EndpointsRuntimeContext.Provider>
  );
}
