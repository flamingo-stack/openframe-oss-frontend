'use client';

import { useDeferredValue } from 'react';
import { create } from 'zustand';

/**
 * The paged lists a change can reach from anywhere: a row added, removed or moved by a dialog, another page or the
 * list's own row actions.
 */
export type RefreshableList = 'invitations';

interface ListRefreshStore {
  /** Bumped once per change; a paged list adds its own to its query's `fetchKey`. */
  epoch: Partial<Record<RefreshableList, number>>;
  mark: (list: RefreshableList) => void;
}

/**
 * A paged list has no `@connection` to edit (a cursor from the URL must read exactly its page), so a change to its
 * rows is the server's to answer: the list reads its page again. A mounted Relay query refetches only for a new
 * `fetchKey`, so each list reads its counter from here, and a change bumps it wherever it happens: the table on
 * screen refetches its page, and a list mounted later asks the network again as every paged list does
 * (`store-and-network`).
 */
const useListRefreshStore = create<ListRefreshStore>()(set => ({
  epoch: {},
  mark: list => set(state => ({ epoch: { ...state.epoch, [list]: (state.epoch[list] ?? 0) + 1 } })),
}));

/** The rows of these lists changed: the one on screen reads its page again. */
export function markListChanged(...lists: RefreshableList[]): void {
  const { mark } = useListRefreshStore.getState();
  for (const list of lists) mark(list);
}

/**
 * The counter a paged list adds to its `fetchKey`. Deferred: a new `fetchKey` can suspend, and deferred the list keeps
 * its rows on screen until the new page arrives instead of dropping to its skeleton.
 */
export function useListRefreshEpoch(list: RefreshableList): number {
  return useDeferredValue(useListRefreshStore(state => state.epoch[list] ?? 0));
}
