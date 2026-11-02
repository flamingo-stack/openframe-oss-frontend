'use client';

/**
 * `useTrackOpenView` — call from an entity detail page to register it as the
 * Mingo "open view". Sets `openView` on mount / id-change and clears it on
 * unmount (rolling it into `recentViews`). The cleared/replaced view feeds the
 * `openView` + `recentViews` carried on every Mingo message.
 *
 * Pass `null`/`undefined` (e.g. while the entity is still loading) to skip
 * tracking until the data resolves. Pass `{ loading: true }` while the entity
 * is being read, so Mingo's context strip draws its loading form instead of
 * appearing (and moving the chat) when the entity lands.
 *
 * @example
 *   useTrackOpenView(device ? { type: 'DEVICE', id: device.id, label: getDeviceName(device) || device.id } : null);
 */

import { useEffect } from 'react';
import { useMingoContextStore } from '../stores/mingo-context-store';
import type { ContextEntityKind } from './context-types';

export interface TrackOpenViewInput {
  type: ContextEntityKind;
  id: string;
  label: string;
  description?: string;
}

export function useTrackOpenView(
  ref: TrackOpenViewInput | null | undefined,
  { loading = false }: { loading?: boolean } = {},
): void {
  const setOpenView = useMingoContextStore(s => s.setOpenView);
  const clearOpenView = useMingoContextStore(s => s.clearOpenView);
  const setOpenViewPending = useMingoContextStore(s => s.setOpenViewPending);

  // Pending while this page reads its entity; cleared when it lands or the page leaves.
  const pending = loading && !ref;
  useEffect(() => {
    if (!pending) return undefined;
    setOpenViewPending(true);
    return () => setOpenViewPending(false);
  }, [pending, setOpenViewPending]);

  // Depend on the primitive fields (not the object identity) so a fresh ref
  // object each render doesn't re-fire. Label/description changes update in
  // place via `setOpenView`'s same-entity refresh branch.
  const type = ref?.type;
  const id = ref?.id;
  const label = ref?.label;
  const description = ref?.description;

  useEffect(() => {
    if (!type || !id) return undefined;
    setOpenView({ type, id, label: label ?? id, description });
    // Clear only if THIS entity is still the open view — a newer detail page
    // mounting during a route transition may already have set its own.
    return () => clearOpenView({ type, id });
  }, [type, id, label, description, setOpenView, clearOpenView]);
}
