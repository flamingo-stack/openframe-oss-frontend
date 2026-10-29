import type { ErrorEvent } from '@sentry/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { isErrorReportingEnabled, redactUrl, scrubEvent } from './error-reporting';
import { OfflineError } from './query-state';
import { UpdateRequiredError } from './version-check';

function setEnv(env: Record<string, string>) {
  window.__ENV = env as typeof window.__ENV;
}

describe('isErrorReportingEnabled', () => {
  afterEach(() => setEnv({}));

  it('stays off in OSS even with a DSN', () => {
    setEnv({ NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' });
    expect(isErrorReportingEnabled()).toBe(false);
    setEnv({ NEXT_PUBLIC_APP_MODE: 'oss-tenant', NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' });
    expect(isErrorReportingEnabled()).toBe(false);
  });

  it('needs a DSN in SaaS', () => {
    setEnv({ NEXT_PUBLIC_APP_MODE: 'saas-tenant' });
    expect(isErrorReportingEnabled()).toBe(false);
    setEnv({ NEXT_PUBLIC_APP_MODE: 'saas-tenant', NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' });
    expect(isErrorReportingEnabled()).toBe(true);
    setEnv({ NEXT_PUBLIC_APP_MODE: 'saas-shared', NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' });
    expect(isErrorReportingEnabled()).toBe(true);
  });
});

describe('redactUrl', () => {
  it('blanks credentials and keeps the rest', () => {
    expect(redactUrl('https://t.example/devices/details/?id=m-1&devTicket=abc')).toBe(
      'https://t.example/devices/details/?id=m-1&devTicket=redacted',
    );
    expect(redactUrl('/auth/callback?code=x&state=y')).toBe('/auth/callback?code=redacted&state=redacted');
    expect(redactUrl('/dashboard/')).toBe('/dashboard/');
  });
});

describe('scrubEvent', () => {
  it('drops failures the app shows as states', () => {
    expect(scrubEvent({} as ErrorEvent, { originalException: new OfflineError('q') })).toBeNull();
    expect(scrubEvent({} as ErrorEvent, { originalException: new UpdateRequiredError() })).toBeNull();
  });

  it('keeps real errors, with the page URL redacted', () => {
    const event = { request: { url: 'https://t.example/?devTicket=abc' } } as ErrorEvent;
    expect(scrubEvent(event, { originalException: new Error('boom') })?.request?.url).toBe(
      'https://t.example/?devTicket=redacted',
    );
  });
});
