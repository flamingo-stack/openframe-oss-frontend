import type { captureRequestError, init } from '@sentry/nextjs';
import type { Instrumentation } from 'next';
import {
  errorReportingOptions,
  resolveErrorReportingConfig,
  SENTRY_DSN_ENV,
  SENTRY_ENVIRONMENT_ENV,
  SERVER_INTEGRATIONS,
} from '@/lib/error-reporting';

/**
 * Server half of error reporting (lib/error-reporting.ts). `register` runs once per server process,
 * before the first request; the SDK is imported only when this deployment reports.
 *
 * Only the Node runtime: nothing here runs on Edge (`src/proxy.ts` is Node in Next 16).
 */

// A computed key: a literal `process.env.NEXT_PUBLIC_*` can be inlined by the build, and these must
// come from the pod's environment.
function runtimeVar(name: string): string {
  return process.env[name] ?? '';
}

let sdk: Promise<{ init: typeof init; captureRequestError: typeof captureRequestError }> | null = null;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const config = resolveErrorReportingConfig(
    runtimeVar('NEXT_PUBLIC_APP_MODE') || 'oss-tenant',
    runtimeVar(SENTRY_DSN_ENV),
    runtimeVar(SENTRY_ENVIRONMENT_ENV),
  );
  if (!config) return;
  sdk = import('@sentry/nextjs').then(Sentry => {
    Sentry.init(errorReportingOptions(config, SERVER_INTEGRATIONS));
    return Sentry;
  });
  await sdk;
}

/** Errors in Server Component renders, route handlers and the proxy, with the request they failed on. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!sdk) return;
  (await sdk).captureRequestError(error, request, context);
};
