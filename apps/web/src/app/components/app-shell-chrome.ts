import type { HeaderLoadingCell } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { isSaasTenantMode } from '@/lib/app-mode';

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
 * order it renders them: time tracker, notifications, then the Mingo launcher. No
 * avatar — the header carries no user cell (`showUser: false`), and reserving one
 * would leave a cell that never fills in.
 *
 * `'wide'` for Mingo is not cosmetic: that cell is content-width (icon + "Mingo AI"
 * wordmark, `gap-2 px-4`), roughly twice a square cell, so reserving a square for it
 * leaves the cluster short and shifts it when the real header lands.
 *
 * Derived from app mode only, which IS known synchronously: Mingo is a SaaS-tenant
 * surface.
 */
export function headerLoadingCells(): HeaderLoadingCell[] {
  return isSaasTenantMode() ? ['icon', 'icon', 'wide'] : ['icon', 'icon'];
}

/**
 * The same for the Mingo-first shell, whose header is the phone top bar only
 * (`desktopHeader: false`): the Chat history cell first (a `start` custom cell,
 * `'icon-max-md'` like every phone-only cell), then the classic cells. The desktop
 * header these would reserve is hidden in CSS from md up, placeholder included.
 */
export function mingoHeaderLoadingCells(): HeaderLoadingCell[] {
  return ['icon-max-md', ...headerLoadingCells()];
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
  // The Mingo-first chat and archive pages fill `<main>` (`h-full`): the default
  // bottom padding would add its height as a scroll under them. In the classic shell
  // both routes only redirect, so the override costs nothing there.
  if (pathname.startsWith('/mingo/chat') || pathname.startsWith('/mingo/archive')) return 'pb-0 md:pb-0';
  return undefined;
}
