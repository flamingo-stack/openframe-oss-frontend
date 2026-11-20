import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { redact, resolveErrorReportingConfig, scrubEvent } from './error-reporting';

describe('resolveErrorReportingConfig', () => {
  it('reports only from a SaaS tenant with a DSN', () => {
    expect(resolveErrorReportingConfig('saas-tenant', 'https://k@o.example/1', 'dev')).toEqual({
      dsn: 'https://k@o.example/1',
      environment: 'dev',
    });
    expect(resolveErrorReportingConfig('saas-tenant', '', 'dev')).toBeNull();
    expect(resolveErrorReportingConfig('oss-tenant', 'https://k@o.example/1', 'dev')).toBeNull();
    expect(resolveErrorReportingConfig('saas-shared', 'https://k@o.example/1', 'dev')).toBeNull();
  });

  it('files an unnamed environment as unknown, never as production', () => {
    expect(resolveErrorReportingConfig('saas-tenant', 'https://k@o.example/1', '')?.environment).toBe('unknown');
  });
});

describe('redact', () => {
  it('drops URL parameter values and keeps their names', () => {
    expect(redact('GET https://t.example/devices/details/?id=42&token=abc#code=x failed')).toBe(
      'GET https://t.example/devices/details/?id=[Filtered]&token=[Filtered]#code=[Filtered] failed',
    );
  });

  it('drops credentials and email addresses', () => {
    expect(redact('Authorization: Bearer abc.def-123')).toBe('Authorization: Bearer [Filtered]');
    expect(redact('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig rejected')).toBe('jwt [Filtered] rejected');
    expect(redact('no account for jane.doe+x@example.co.uk')).toBe('no account for [Filtered]');
  });
});

describe('scrubEvent', () => {
  it('keeps the error and its stack, drops who and what the request carried', () => {
    const event = {
      type: undefined,
      message: 'see https://t.example/?q=secret',
      user: { id: 'u1', email: 'a@b.example', ip_address: '10.0.0.1' },
      breadcrumbs: [{ message: 'clicked' }],
      extra: { body: 'x' },
      tags: { url: 'https://t.example/a?b=c' },
      contexts: { nextjs: { request_path: '/x?y=z', route_type: 'render' } },
      request: {
        url: 'https://t.example/mingo/?session=s1',
        method: 'POST',
        query_string: 'session=s1',
        cookies: { of_access_token: 't' },
        data: '{"password":"p"}',
        headers: {
          Authorization: 'Bearer t',
          Cookie: 'of_access_token=t',
          'User-Agent': 'UA',
          Referer: 'https://t.example/auth/?code=c',
        },
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'fetch https://t.example/api?token=t failed',
            stacktrace: {
              frames: [{ filename: 'app:///_next/static/chunks/a.js', lineno: 1, colno: 2, vars: { a: 1 } }],
            },
          },
        ],
      },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);

    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toEqual({
      url: 'https://t.example/mingo/?session=[Filtered]',
      method: 'POST',
      headers: { 'User-Agent': 'UA', Referer: 'https://t.example/auth/?code=[Filtered]' },
    });
    expect(out.message).toBe('see https://t.example/?q=[Filtered]');
    expect(out.tags).toEqual({ url: 'https://t.example/a?b=[Filtered]' });
    expect(out.contexts?.nextjs).toEqual({ request_path: '/x?y=[Filtered]', route_type: 'render' });
    const [exception] = out.exception?.values ?? [];
    expect(exception?.value).toBe('fetch https://t.example/api?token=[Filtered] failed');
    expect(exception?.stacktrace?.frames).toEqual([
      { filename: 'app:///_next/static/chunks/a.js', lineno: 1, colno: 2 },
    ]);
  });
});
