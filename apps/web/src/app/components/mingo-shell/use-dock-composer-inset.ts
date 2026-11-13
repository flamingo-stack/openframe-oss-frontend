'use client';

import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useManhattanDock } from '../manhattan-shell/manhattan-dock-context';

/**
 * The docked composer's side inset (`EmbeddableChat` `composerInset`), for the composer and for what lines up with it
 * (the quick actions row above it): `wide` in Manhattan v2 from md (none below 720px of content), else `always`.
 * Before the window is measured the wide form, as the dock always drew it.
 */
export function useDockComposerInset(): 'always' | 'wide' {
  const manhattan = useManhattanDock();
  const mdDown = useMdUp() === false;
  return manhattan && !mdDown ? 'wide' : 'always';
}
