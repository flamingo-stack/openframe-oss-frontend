'use client';

import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components';
import { AnnouncementBarView } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { EndpointsRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { type ReactNode, useState } from 'react';
import { useActiveAnnouncement } from '@/app/hooks/use-active-announcement';
import { ANNOUNCEMENT_SEED_BACKGROUND_VAR } from '@/lib/announcement-cache';
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

/**
 * The announcement in the `topBar` slot, and what takes the slot while it shows nothing (none published, dismissed,
 * not for this path or shell): the outdated-client bar. `whileHidden` waits for the bar's first report, which comes
 * after its first commit: a stored announcement draws in that commit, and starting from "not shown" stacked the
 * other bar under it for a frame (CU-17tkuw69v1p).
 */
export function AnnouncementSlot({ whileHidden }: { whileHidden?: ReactNode }) {
  const [shown, setShown] = useState<boolean | null>(null);
  return (
    <>
      <AnnouncementTopBar onExpandedChange={setShown} />
      {shown === false && whileHidden}
    </>
  );
}

/**
 * The bar's room before its slot opens (`/me` has not answered yet), for a stored announcement that would draw a
 * bar on this page (`announcementSeedScript` marks `<html>` before paint): the bar's own strip, in the stored
 * announcement's background, with nothing in it, so the page under it does not move when the bar replaces it
 * (CU-17tkuw69v1p). Hidden in CSS everywhere else, the server's markup included.
 */
export function AnnouncementBarSeed() {
  return (
    <div aria-hidden className="hidden [html[data-announcement]_&]:block" data-announcement-seed="">
      <AnnouncementBarView style={{ backgroundColor: `var(${ANNOUNCEMENT_SEED_BACKGROUND_VAR})` }} />
    </div>
  );
}
