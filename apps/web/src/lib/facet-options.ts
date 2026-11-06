'use client';

import { useState } from 'react';

/** One option of a server facet as the funnel queries select it. */
export interface FacetRow {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/**
 * A funnel's options with every ticked value the answer left out appended at zero (`atZero` builds it). A server facet
 * leaves out a value the search or another funnel takes to zero, and a funnel with no options draws no list: without
 * this, a tick could not be taken back. Pass the ticks the funnel draws (the URL's), not the query's filter, so a value
 * this build drops from the query is still offered to untick.
 */
export function withSelected<T extends { readonly value: string }>(
  options: readonly T[],
  selected: readonly string[],
  atZero: (value: string) => T,
): T[] {
  const offered = new Set(options.map(option => option.value));
  return [...options, ...selected.filter(value => !offered.has(value)).map(atZero)];
}

type LabelledFacet = ReadonlyArray<Pick<FacetRow, 'value' | 'label'>>;

type SeenLabels = ReadonlyMap<string, ReadonlyMap<string, string>>;

const NOTHING_SEEN: SeenLabels = new Map();

function remember(seen: SeenLabels, answer: Readonly<Record<string, LabelledFacet>> | null | undefined): SeenLabels {
  if (!answer) return seen;
  const next = new Map(seen);
  for (const [facet, options] of Object.entries(answer)) {
    next.set(
      facet,
      new Map([...(seen.get(facet) ?? []), ...options.map(({ value, label }) => [value, label] as const)]),
    );
  }
  return next;
}

/**
 * What each value was called in the answers so far, by facet: a ticked value a later answer leaves out keeps the name
 * it was ticked under (a customer, a SKU) instead of its id. React's "adjust state while rendering": the labels move on
 * when `answer` does, so pass the query's own record, whose identity Relay keeps, never a copy made in render.
 */
export function useSeenLabels<K extends string>(
  answer: Readonly<Record<K, LabelledFacet>> | null | undefined,
): (facet: K, value: string) => string | undefined {
  const [seen, setSeen] = useState(() => ({ answer, labels: remember(NOTHING_SEEN, answer) }));
  let { labels } = seen;
  if (answer !== seen.answer) {
    labels = remember(labels, answer);
    setSeen({ answer, labels });
  }
  return (facet, value) => labels.get(facet)?.get(value);
}
