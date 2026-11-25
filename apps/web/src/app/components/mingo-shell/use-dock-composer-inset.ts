'use client';

import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useManhattanComposerPlace } from '../manhattan-shell/manhattan-composer-host';
import { useManhattanDock } from '../manhattan-shell/manhattan-dock-context';

/**
 * The docked composer's side inset (`EmbeddableChat` `composerInset`), for the composer, its loading form and what
 * lines up with it (the quick actions row above it). `wide` (none below 720px of content) only in the Manhattan v2
 * chat column from md, where the column pads the composer itself (`COLUMN_COMPOSER_SECTION`); under a page, on a
 * phone and outside v2 `always`, so the composer never touches the sidebars beside a narrow centre (CU-17tkuw68taa).
 */
export function useDockComposerInset(): 'always' | 'wide' {
  const manhattan = useManhattanDock();
  const mdDown = useMdUp() === false;
  const place = useManhattanComposerPlace();
  return manhattan && !mdDown && place === 'column' ? 'wide' : 'always';
}
