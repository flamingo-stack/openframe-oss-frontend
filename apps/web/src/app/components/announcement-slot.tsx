'use client';

import { type ReactNode, useState } from 'react';
import { AnnouncementTopBar } from './announcement-top-bar';

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
