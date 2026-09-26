'use client';

import { useEffect, useState } from 'react';

/**
 * Whether a sentinel above the list is within `rootMargin` of the viewport —
 * "not scrolled away from the top". A callback ref, so the observer follows the
 * node when the list re-renders it; one left on a detached node never reports.
 */
export function useIsAtTop<T extends HTMLElement>(
  rootMargin = '120px',
): { ref: (node: T | null) => void; atTop: boolean } {
  const [node, setNode] = useState<T | null>(null);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry) setAtTop(entry.isIntersecting);
      },
      // Rooted on the app's scroller: `rootMargin` grows only the root, and `<main>`
      // would clip a viewport-rooted margin away (shared/empty-state does the same).
      { root: node.closest('main'), rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin]);

  return { ref: setNode, atTop };
}
