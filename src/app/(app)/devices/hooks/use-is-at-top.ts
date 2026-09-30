'use client';

import { useEffect, useState } from 'react';

/** Whether a sentinel above a list is within `rootMargin` of the scroller's top, or still below the fold. A callback ref, so a re-rendered node is re-observed. */
export function useIsAtTop<T extends HTMLElement>(
  rootMargin = '120px',
): { ref: (node: T | null) => void; atTop: boolean } {
  const [node, setNode] = useState<T | null>(null);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // Under a tall header the list starts below the first screen; nothing has been scrolled past yet.
        const belowFold = entry.boundingClientRect.top >= (entry.rootBounds?.bottom ?? window.innerHeight);
        setAtTop(entry.isIntersecting || belowFold);
      },
      // The app scrolls `<main>`, which would clip a viewport-rooted margin (see shared/empty-state).
      { root: node.closest('main'), rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin]);

  return { ref: setNode, atTop };
}
