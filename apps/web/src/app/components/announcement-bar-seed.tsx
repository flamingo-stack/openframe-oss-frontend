'use client';

import { AnnouncementBarView } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ANNOUNCEMENT_SEED_BACKGROUND_VAR } from '@/lib/announcement-cache';

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
