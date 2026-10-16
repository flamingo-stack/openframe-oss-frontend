import type { HeaderLoadingCell } from '@flamingo-stack/openframe-frontend-core/components/navigation';

/**
 * Shell constants the LIVE `AppLayout` needs. The chrome has no separate placeholder
 * copy: its own `loading` props cover that window from inside the real sidebar and
 * header, so nothing here draws a parallel one.
 *
 * Framework-neutral on purpose (no `'use client'`): the (app) group layout, a
 * server-adjacent module, imports it.
 */

/**
 * The trailing header cells the live header reserves while the chrome loads, in the
 * order it renders them: the time tracker, then notifications (an OSS tenant has no
 * Mingo cell). No avatar — the header carries no user cell (`showUser: false`), and
 * reserving one would leave a cell that never fills in.
 */
export function headerLoadingCells(): HeaderLoadingCell[] {
  return ['icon', 'icon'];
}

/**
 * The same for the Mingo-first shell, whose header is the phone top bar only
 * (`desktopHeader: false`): the Chat history cell first (a `start` custom cell,
 * `'icon-max-md'` like every phone-only cell), then the time tracker, notifications
 * and the Mingo launcher. `'wide'` for Mingo is not cosmetic: that cell is
 * content-width (icon + "Mingo AI" wordmark), roughly twice a square cell, so a
 * square would leave the cluster short and shift it when the real header lands.
 */
export function mingoHeaderLoadingCells(): HeaderLoadingCell[] {
  return ['icon-max-md', 'icon', 'icon', 'wide'];
}

/**
 * Bottom padding the (app) group layout passes to the live `<main>` for standard
 * routes (its `mainClassNameOverride || …` fallback). Defined here — not in
 * app-layout.tsx — because that file imports this one and the constant must be
 * shared without a cycle.
 */
export const APP_MAIN_CLASS_NAME = 'pb-14';

/**
 * Per-route `<main>` padding overrides. Lives here, beside `APP_MAIN_CLASS_NAME`
 * and for the same reason: the (app) group layout imports this file, so the
 * constants must be shared without a cycle.
 */
export function getMainClassNameOverride(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  if (pathname.startsWith('/devices/details/file-manager')) return 'pb-0 md:pb-0';
  if (pathname.startsWith('/tickets')) return 'pb-0 md:pb-0';
  if (pathname.startsWith('/settings')) return 'pb-0 md:pb-0';
  // The Mingo chat and archive pages fill `<main>` (`h-full`): the default bottom
  // padding would add its height as a scroll under them.
  if (pathname.startsWith('/mingo/chat') || pathname.startsWith('/mingo/archive')) return 'pb-0 md:pb-0';
  return undefined;
}
