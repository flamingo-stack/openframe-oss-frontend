/**
 * Application mode configuration and utilities
 * Controls whether the app runs in auth-only mode or full application mode
 */

import { isAppShell } from './platform';
import { routes } from './routes';
import { runtimeEnv } from './runtime-config';

export type AppMode = 'oss-tenant' | 'saas-tenant' | 'saas-shared';

/**
 * Get the current application mode from environment variable
 * @returns The current app mode, defaults to 'oss-tenant'
 */
export function getAppMode(): AppMode {
  const mode = runtimeEnv.appMode() as AppMode;
  return (mode as AppMode) || 'oss-tenant';
}

/**
 * Check if the app is running in auth-only mode
 * @returns True if in auth-only mode
 */
export function isAuthOnlyMode(): boolean {
  // Backward-compatible alias for auth-only behavior
  return getAppMode() === 'saas-shared';
}

export function isOssTenantMode(): boolean {
  return getAppMode() === 'oss-tenant';
}

export function isSaasTenantMode(): boolean {
  return getAppMode() === 'saas-tenant';
}

export function isSaasSharedMode(): boolean {
  return getAppMode() === 'saas-shared';
}

/**
 * Whether the auth screens should present the SaaS shared-auth sign-up UX
 * (subdomain field with the SaaS suffix, live availability, trial copy).
 *
 * Not the same question as {@link isSaasSharedMode}: the native shell ships its
 * own copy of the auth pages inside a `saas-tenant` bundle (see the isAppShell
 * exception in isRouteAllowedInCurrentMode), so mode alone would render the
 * bring-your-own-domain variant there — including submitting the domain
 * unqualified instead of `<subdomain>.<SAAS_DOMAIN_SUFFIX>`.
 */
export function isSharedAuthUi(): boolean {
  return isSaasSharedMode() || (isSaasTenantMode() && isAppShell());
}

/**
 * Check if the app is running in full application mode
 * @returns True if in full application mode
 */
export function isFullAppMode(): boolean {
  // Kept for compatibility: means app pages are enabled
  return isOssTenantMode() || isSaasTenantMode();
}

/**
 * Whether authentication features (auth pages/flows) are enabled in current mode
 */
export function isAuthEnabled(): boolean {
  return isOssTenantMode() || isSaasSharedMode();
}

/**
 * Whether application pages are enabled in current mode
 */
export function isAppEnabled(): boolean {
  return isOssTenantMode() || isSaasTenantMode();
}

/**
 * Check if a route is allowed in the current app mode
 * @param pathname The route path to check
 * @returns True if the route is allowed in current mode
 *
 * APP MODE ONLY. Everything this answers is decided by `NEXT_PUBLIC_APP_MODE`
 * and the shell — facts that are true before the first paint. It used to also
 * block the purchase surfaces on `!isPaymentUiEnabled()`, and that was the bug
 * behind the "Access restricted" screen: `isPaymentUiEnabled()` reads the
 * server-loaded `billings` flag, which is simply *unanswered* on a cold load, so
 * the guard read "not yet" as "not allowed" and threw the refusal over billing
 * routes until the flags query came back.
 *
 * Do NOT reintroduce a check here that depends on data still in flight. Pages
 * whose existence depends on loaded state gate themselves, where a tri-state
 * (`loading | on | off`) can be told apart — see `billing-usage/page.tsx` and
 * the `/checkout/*` pages, which 404 on their own.
 */
export function isRouteAllowedInCurrentMode(pathname: string): boolean {
  const mode = getAppMode();

  // Always allow Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/icons')
  ) {
    return true;
  }

  // Account-deletion instructions are reachable in EVERY mode, signed out. Both
  // stores require a deletion URL that resolves in a browser without installing
  // the app and without an account — a user who was removed by an admin or lost
  // their password is exactly who needs it. The canonical URL lives on the
  // shared (saas-shared) host, the only host that is the same for every tenant,
  // and that mode otherwise allows `/auth` and `/` only. `startsWith` covers the
  // `trailingSlash: true` form.
  if (pathname.startsWith(routes.accountDeletion)) {
    return true;
  }

  // The app-download page is a browser errand: it hands out the installers for the
  // very shells it would be running inside. Same belt-and-braces as above — the page
  // 404s on its own, this closes the deep-link and restored-history routes to it.
  if (isAppShell() && pathname.startsWith(routes.settings.downloadApps)) {
    return false;
  }

  if (mode === 'saas-shared') {
    // Auth-only mode: only auth routes and root
    return pathname.startsWith('/auth') || pathname === '/';
  }

  // Architecture settings are OSS-only
  if (mode !== 'oss-tenant' && pathname.startsWith('/settings/architecture')) {
    return false;
  }

  if (mode === 'saas-tenant') {
    // App-only mode: block all auth routes — except in the native shell, where
    // the auth pages are the sign-in entry point (email → tenant discovery →
    // provider selection → system-browser OAuth).
    return isAppShell() || !pathname.startsWith('/auth');
  }

  if (mode === 'oss-tenant') {
    if (pathname.startsWith('/mingo')) {
      return false;
    }
  }

  return true;
}

/**
 * Get the default redirect path for the current app mode
 * @param isAuthenticated Whether the user is authenticated
 * @returns The path to redirect to
 */
export function getDefaultRedirectPath(isAuthenticated: boolean): string {
  const mode = getAppMode();

  if (mode === 'saas-shared') {
    return '/auth';
  }

  if (mode === 'saas-tenant') {
    // Native shell has auth pages enabled — land unauthenticated users there.
    if (isAppShell() && !isAuthenticated) {
      return '/auth';
    }
    // App-only: send users to the app landing (no auth pages)
    return '/dashboard';
  }

  // oss-tenant: auth + app
  return isAuthenticated ? '/dashboard' : '/auth';
}

/**
 * Check if the navigation sidebar should be shown
 * @returns True if sidebar should be shown
 */
export function shouldShowNavigationSidebar(): boolean {
  return isAppEnabled();
}

/**
 * Check if app-specific pages should be accessible
 * @returns True if app pages should be accessible
 */
export function shouldShowAppPages(): boolean {
  return isAppEnabled();
}
