'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { pageFaq } from './endpoints';

/**
 * The topic of the page on screen, for the chat. A page STATES its topic
 * (`useStatePageTopic`, or `usePageFaq` for a page with a FAQ block); it is
 * never read from the route. The chat, which lives outside the page, reads it
 * (`usePageTopic`) and asks the hub for that topic's quick actions first, then
 * the ones written for no topic. A page that states none: no topic.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

function publish(topic: string | null): void {
  if (current === topic) return;
  current = topic;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** States the page's topic while the page is mounted. */
export function useStatePageTopic(topic: string): void {
  useLayoutEffect(() => {
    publish(topic);
    // Leaving the page clears it, unless the next page has already stated its own.
    return () => {
      if (current === topic) publish(null);
    };
  }, [topic]);
}

/** The topic the page on screen stated, or undefined. */
export function usePageTopic(): string | undefined {
  return (
    useSyncExternalStore(
      subscribe,
      () => current,
      () => null,
    ) ?? undefined
  );
}

/** A Help Center page's FAQ block (`pageFaq`), its topic also stated for the chat. */
export function usePageFaq(topic: string): ReturnType<typeof pageFaq> {
  useStatePageTopic(topic);
  return pageFaq(topic);
}
