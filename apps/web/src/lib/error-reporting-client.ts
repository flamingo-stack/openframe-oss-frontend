/**
 * Browser half of error reporting (`error-reporting.ts` has the shared rules).
 *
 * The SDK is a separate chunk loaded only when this deployment reports, so an OSS install, a tenant
 * without a DSN and the native shells never download it. `initBrowserErrorReporting` runs from
 * `src/instrumentation-client.ts`, before hydration: the runtime env it reads is already in place
 * because the root layout renders `<PublicEnvScript disableNextScript />` as a plain inline script.
 */
import type { captureException, init } from '@sentry/nextjs';
import { BROWSER_INTEGRATIONS, errorReportingOptions, resolveErrorReportingConfig } from './error-reporting';
import { isAppShell } from './platform';
import { runtimeEnv } from './runtime-config';

let sdk: Promise<{ init: typeof init; captureException: typeof captureException }> | null = null;

export function initBrowserErrorReporting(): void {
  if (sdk || typeof window === 'undefined' || isAppShell()) return;
  const config = resolveErrorReportingConfig(
    runtimeEnv.appMode(),
    runtimeEnv.sentryDsn(),
    runtimeEnv.sentryEnvironment(),
  );
  if (!config) return;
  sdk = import('@sentry/nextjs').then(Sentry => {
    Sentry.init(errorReportingOptions(config, BROWSER_INTEGRATIONS));
    return Sentry;
  });
}

/**
 * Reports an error a route or global error boundary caught: React hands those to the boundary
 * instead of the window's error handlers, so the SDK would never see them.
 *
 * An error with a `digest` came from a Server Component render. The browser only has its redacted
 * copy, and the server already reported the original through `onRequestError`, so it is skipped.
 */
export function reportBoundaryError(error: Error & { digest?: string }, boundary: string): void {
  if (!sdk || error.digest) return;
  void sdk.then(Sentry => Sentry.captureException(error, { tags: { error_boundary: boundary } }));
}
