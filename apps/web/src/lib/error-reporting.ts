import type { ErrorEvent, EventHint } from '@sentry/browser';
import { getAppMode, isOssTenantMode } from './app-mode';
import { clientBundleVersion } from './client-identity';
import { mobilePlatform, shellKind } from './platform';
import { isOfflineError } from './query-state';
import { runtimeEnv } from './runtime-config';
import { UpdateRequiredError } from './version-check';

const importSdk = () => import('./error-reporting-sdk');
type Sentry = Awaited<ReturnType<typeof importSdk>>;

let sdk: Promise<Sentry | null> | null = null;

/** SaaS only: an OSS install never reports, whatever its env says. */
export function isErrorReportingEnabled(): boolean {
  return typeof window !== 'undefined' && !isOssTenantMode() && runtimeEnv.sentryDsn() !== '';
}

const SENSITIVE_PARAM = /token|ticket|code|state|secret|password/i;

/** Query values that authenticate (`?devTicket=`, OAuth `code`/`state`) never leave the device. */
export function redactUrl(url: string): string {
  const queryAt = url.indexOf('?');
  if (queryAt < 0) return url;
  const params = new URLSearchParams(url.slice(queryAt + 1));
  for (const key of [...params.keys()]) {
    if (SENSITIVE_PARAM.test(key)) params.set(key, 'redacted');
  }
  return `${url.slice(0, queryAt)}?${params.toString()}`;
}

/** Failures the app already handles as states, not bugs. */
export function scrubEvent(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  const error = hint.originalException;
  if (isOfflineError(error) || error instanceof UpdateRequiredError) return null;
  const url = event.request?.url;
  return url ? { ...event, request: { ...event.request, url: redactUrl(url) } } : event;
}

function start(Sentry: Sentry): Sentry {
  const release = clientBundleVersion();
  Sentry.init({
    dsn: runtimeEnv.sentryDsn(),
    environment: runtimeEnv.sentryEnvironment(),
    release: release === '-' ? undefined : release,
    // Console is the app's logging channel; what it prints is not vetted for leaving the device.
    integrations: defaults => defaults.filter(integration => integration.name !== 'Console'),
    beforeSend: scrubEvent,
    beforeBreadcrumb: breadcrumb => {
      const data = breadcrumb.data;
      for (const key of ['url', 'from', 'to']) {
        if (data && typeof data[key] === 'string') data[key] = redactUrl(data[key]);
      }
      return breadcrumb;
    },
    initialScope: { tags: { shell: mobilePlatform() ?? shellKind(), app_mode: getAppMode() } },
  });
  return Sentry;
}

// Loaded on first use, so a bundle that never reports never downloads the SDK.
function loadSdk(): Promise<Sentry | null> {
  sdk ??= importSdk().then(start, () => null);
  return sdk;
}

export function initErrorReporting(): void {
  if (isErrorReportingEnabled()) void loadSdk();
}

/** For errors a boundary caught: those never reach the SDK's global handlers. */
export function reportError(error: unknown, boundary: string): void {
  if (!isErrorReportingEnabled()) return;
  void loadSdk().then(Sentry => Sentry?.captureException(error, { tags: { boundary } }));
}

/** Id only — no email or name. The tenant tells shell events apart, whose origin is the device. */
export function setErrorReportingUser(userId: string | null): void {
  if (!isErrorReportingEnabled()) return;
  void loadSdk().then(Sentry => {
    Sentry?.setUser(userId ? { id: userId } : null);
    Sentry?.setTag('tenant', userId ? tenantHost() : undefined);
  });
}

function tenantHost(): string | undefined {
  try {
    return new URL(runtimeEnv.tenantHostUrl() || window.location.origin).host;
  } catch {
    return undefined;
  }
}
