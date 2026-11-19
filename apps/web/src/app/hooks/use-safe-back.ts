'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Probes `window.navigation.canGoBack` (Navigation API: Chrome 102+, Edge
 * 102+, Safari 16.4+). The API surface is not present in every TS `lib.dom`
 * version we build against, and global type augmentation collides with the
 * built-in `Navigation` interface on TS versions that already ship it — so
 * we read defensively through an `unknown` cast instead of typed access.
 * Returns `false` for unsupported browsers and for `canGoBack === false`,
 * which both mean `router.back()` is unsafe.
 */
export function navCanGoBack(): boolean {
  if (typeof window === 'undefined') return false;
  const probed = window as unknown as {
    navigation?: { canGoBack?: boolean };
  };
  const canGoBack = probed.navigation?.canGoBack;
  return typeof canGoBack === 'boolean' ? canGoBack : false;
}

/**
 * Returns a back-navigation handler that uses `window.navigation.canGoBack`
 * to decide whether `router.back()` is safe — i.e. there is at least one
 * same-document history entry behind the current one. When the API is
 * missing or returns `false` (fresh tab, cross-origin entry behind, direct
 * URL paste) the handler navigates deterministically to `fallback` instead
 * of risking a back that leaves the origin or no-ops.
 */
export function useSafeBack(fallback: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    const steps = navCanGoBack() ? stepsBackToPreviousPage() : null;
    if (steps === 1) router.back();
    else if (steps !== null) window.history.go(-steps);
    else router.push(fallback);
  }, [router, fallback]);
}

interface NavigationEntryLike {
  url: string | null;
  index: number;
}

/** The page an entry shows: its path and its `id` (a detail page's entity). Its other params are the page's own state. */
function pageOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.pathname.replace(/\/+$/, '')}?${parsed.searchParams.get('id') ?? ''}`;
  } catch {
    return null;
  }
}

/**
 * How many history entries back the nearest entry showing ANOTHER page is (another path, or another `id`), so the
 * entries a page added for itself (a paged table's pages, pushed one by one) are skipped and the page's Back leaves
 * it. `1` when the entry behind is already another page (the common case: the same as `router.back()`); `null` when
 * every entry behind is this page (or nothing is behind), so the caller takes its fallback route.
 */
export function stepsBackToPreviousPage(): number | null {
  if (typeof window === 'undefined') return null;
  const navigation = (
    window as unknown as {
      navigation?: { currentEntry?: NavigationEntryLike | null; entries?: () => NavigationEntryLike[] };
    }
  ).navigation;
  const current = navigation?.currentEntry;
  // An API that says it can go back but cannot list the entries (older engines): one step, as before.
  if (!current || typeof navigation.entries !== 'function') return navCanGoBack() ? 1 : null;
  const entries = navigation.entries();
  const here = pageOf(current.url);
  for (let index = current.index - 1; index >= 0; index--) {
    if (pageOf(entries[index]?.url ?? null) !== here) return current.index - index;
  }
  return null;
}

/**
 * After a save/edit submit, navigate back when safe so the form entry is
 * popped from history (the form is then "forward", not in the back stack).
 * This lets browser back from the resulting page return to wherever the
 * user was before the form. Falls back to `router.replace(fallback)` when
 * back is unsafe (direct URL paste, missing Navigation API), which keeps
 * the form out of history without risking a no-op or leaving the origin.
 */
export function safeBackOrReplace(router: AppRouter, fallback: string): void {
  if (navCanGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
