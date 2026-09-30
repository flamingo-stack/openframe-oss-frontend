'use client';

import { useEffect, useState } from 'react';

/** Whether a sentinel above a list is within `rootMargin` of the scroller's top. A callback ref, so a re-rendered node is re-observed. */
export function useIsAtTop<T extends HTMLElement>(
  rootMargin = '120px',
): { ref: (node: T | null) => void; atTop: boolean } {
  const [node, setNode] = useState<T | null>(null);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setAtTop(entry.isIntersecting);
      },
      // The app scrolls `<main>`, which would clip a viewport-rooted margin (see shared/empty-state).
      { root: node.closest('main'), rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin]);

  return { ref: setNode, atTop };
}
