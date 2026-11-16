/**
 * Application error reporting (Sentry): the rules the browser and the Next server share.
 *
 * Off unless a deployment asks for it. Both runtimes report only when the app runs as a SaaS
 * tenant AND was handed a DSN at runtime (`NEXT_PUBLIC_SENTRY_DSN`). The DSN is never read at build
 * time, so the shared image, its browser bundles and the shells' static export carry none; OSS
 * installs and every deployment without the variable never load the SDK at all. The native shells
 * never report either (`error-reporting-client.ts`): a new SDK on a phone changes the privacy label,
 * which only a store build may do (apps/web/CLAUDE.md, "Over-the-air bundles").
 *
 * Errors only. No tracing (no `tracesSampleRate`, so no span is recorded or sent), Session Replay,
 * Sentry Logs, sessions, client reports or breadcrumbs, and every event passes {@link scrubEvent} first: no user, cookies, request bodies, auth headers or URL
 * parameter values leave the process.
 *
 * Wiring: `src/instrumentation-client.ts` (browser), `src/instrumentation.ts` (Node server and its
 * `onRequestError`), the route and global error boundaries (errors React caught never reach the
 * global handlers). Source maps: `scripts/sentry-sourcemaps.mjs`.
 */
import type { ErrorEvent, getDefaultIntegrations } from '@sentry/nextjs';
import { clientBundleVersion } from './client-identity';

// `@sentry/core` declares the type, and is not this app's dependency; the SDK's own default list names it.
type Integration = ReturnType<typeof getDefaultIntegrations>[number];

export const SENTRY_DSN_ENV = 'NEXT_PUBLIC_SENTRY_DSN';
export const SENTRY_ENVIRONMENT_ENV = 'NEXT_PUBLIC_SENTRY_ENVIRONMENT';

export interface ErrorReportingConfig {
  dsn: string;
  environment: string;
}

/** The one switch: a SaaS tenant with a DSN reports, everything else stays silent. */
export function resolveErrorReportingConfig(
  appMode: string,
  dsn: string,
  environment: string,
): ErrorReportingConfig | null {
  if (appMode !== 'saas-tenant' || !dsn) return null;
  // An unnamed environment is filed visibly wrong rather than under Sentry's default, `production`.
  return { dsn, environment: environment || 'unknown' };
}

/**
 * The release both runtimes tag their events with: the bundle version `X-OpenFrame-Client` reports
 * (`pr-N-<sha7>`, `main-<sha7>`, `x.y.z`), inlined at build time. The source map upload names the
 * same value.
 */
export function errorReportingRelease(): string | undefined {
  const version = clientBundleVersion();
  return version === '-' ? undefined : version;
}

/**
 * Integrations kept from the SDK defaults, by name; anything not listed is dropped. Left out on
 * purpose: breadcrumbs (console, clicks, fetch URLs), sessions, tracing, Replay, feedback, the module
 * list, and the Node console and child-process breadcrumbs.
 */
export const BROWSER_INTEGRATIONS: ReadonlySet<string> = new Set([
  'EventFilters',
  'FunctionToString',
  'BrowserApiErrors',
  'GlobalHandlers',
  'LinkedErrors',
  'Dedupe',
  'HttpContext',
  'NextjsClientStackFrameNormalization',
]);

export const SERVER_INTEGRATIONS: ReadonlySet<string> = new Set([
  'EventFilters',
  'FunctionToString',
  'LinkedErrors',
  'Dedupe',
  'RequestData',
  'Http',
  'NodeFetch',
  'OnUncaughtException',
  'OnUnhandledRejection',
  'ContextLines',
  'Context',
  'DistDirRewriteFrames',
]);

/** SDK options both runtimes share; each adds nothing but its own integration list. */
export function errorReportingOptions(config: ErrorReportingConfig, keep: ReadonlySet<string>) {
  return {
    dsn: config.dsn,
    environment: config.environment,
    release: errorReportingRelease(),
    sendDefaultPii: false,
    sendClientReports: false,
    enableLogs: false,
    maxBreadcrumbs: 0,
    integrations: (defaults: Integration[]) => defaults.filter(integration => keep.has(integration.name)),
    beforeBreadcrumb: () => null,
    beforeSend: scrubEvent,
  };
}

// The value of every URL query or fragment parameter, wherever a URL appears in text.
const URL_PARAM_VALUE = /([?&#;][^=&#;\s"'<>]+=)[^&#;\s"'<>]*/g;
const AUTH_SCHEME_VALUE = /\b(Bearer|Basic)\s+[\w.~+/=-]+/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const FILTERED = '[Filtered]';

/** Strips parameter values, credentials and email addresses from free text; keeps the rest readable. */
export function redact(text: string): string {
  return text
    .replace(URL_PARAM_VALUE, `$1${FILTERED}`)
    .replace(AUTH_SCHEME_VALUE, `$1 ${FILTERED}`)
    .replace(JWT, FILTERED)
    .replace(EMAIL, FILTERED);
}

/** The request headers an event keeps; cookies, authorization and everything else are dropped. */
const KEPT_HEADERS = new Set(['user-agent', 'accept', 'content-type', 'referer']);

function keptHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined;
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (KEPT_HEADERS.has(name.toLowerCase())) kept[name] = redact(String(value));
  }
  return kept;
}

function redactValues<T extends object>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? redact(value) : value]),
  ) as T;
}

/**
 * `beforeSend` in both runtimes. Keeps the error, its stack and where it happened (path, method,
 * route, release, environment, browser or server context); drops who it happened to and anything a
 * request carried.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { user: _user, breadcrumbs: _breadcrumbs, extra: _extra, request, exception, ...kept } = event;
  const scrubbed: ErrorEvent = { ...kept };

  if (request) {
    const { url, method, headers } = request;
    scrubbed.request = {
      ...(url ? { url: redact(url) } : {}),
      ...(method ? { method } : {}),
      ...(headers ? { headers: keptHeaders(headers) } : {}),
    };
  }

  if (kept.message) scrubbed.message = redact(kept.message);
  if (kept.logentry?.message) scrubbed.logentry = { ...kept.logentry, message: redact(kept.logentry.message) };
  if (kept.transaction) scrubbed.transaction = redact(kept.transaction);
  if (kept.tags) scrubbed.tags = redactValues(kept.tags);
  if (kept.contexts) {
    scrubbed.contexts = Object.fromEntries(
      Object.entries(kept.contexts).map(([name, context]) => [name, context && redactValues(context)]),
    );
  }

  if (exception) {
    scrubbed.exception = {
      ...exception,
      values: exception.values?.map(value => ({
        ...value,
        ...(value.value ? { value: redact(value.value) } : {}),
        ...(value.stacktrace
          ? {
              stacktrace: {
                ...value.stacktrace,
                frames: value.stacktrace.frames?.map(({ vars: _vars, ...frame }) => frame),
              },
            }
          : {}),
      })),
    };
  }

  return scrubbed;
}
