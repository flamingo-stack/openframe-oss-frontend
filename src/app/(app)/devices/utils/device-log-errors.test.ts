// The list's failed state is chosen by `extensions.code`, not by message text:
// a vanished device, a rejected filter and a WAF-rejected search each need their
// own UI, and an unknown failure must fall back to Retry, never to a blank list.
import { describe, expect, it } from 'vitest';
import { OfflineError } from '@/lib/query-state';
import { describeDeviceLogError, isRetryableDeviceLogError } from './device-log-errors';

/** Relay's thrown error: the classified entry first, then graphql-java's non-null follow-up. */
function relayError(code: string, message: string) {
  const error = new Error(`No data returned for operation, got error(s): ${message}`);
  Object.assign(error, {
    source: {
      errors: [
        { message, extensions: { code, httpStatus: 404 } },
        { message: "The field at path '/deviceLogs' was declared as a non null type…", extensions: {} },
      ],
    },
  });
  return error;
}

describe('describeDeviceLogError', () => {
  it('maps the API codes to their states', () => {
    expect(describeDeviceLogError(relayError('DEVICE_NOT_FOUND', 'Machine not found'), { hasSearch: false }).kind).toBe(
      'not-found',
    );
    const validation = describeDeviceLogError(relayError('VALIDATION_ERROR', 'Time range cannot exceed 30 days'), {
      hasSearch: false,
    });
    expect(validation.kind).toBe('validation');
    expect(validation.message).toBe('Time range cannot exceed 30 days');
    expect(describeDeviceLogError(relayError('LOKI_QUERY_ERROR', 'loki down'), { hasSearch: true }).kind).toBe(
      'unavailable',
    );
    expect(describeDeviceLogError(relayError('INTERNAL_ERROR', 'boom'), { hasSearch: true }).kind).toBe('generic');
  });

  it('reads a bodiless non-200 during a search as rejected search text, never as a crash', () => {
    const transport = new Error('Relay fetch failed: 502 Bad Gateway');
    expect(describeDeviceLogError(transport, { hasSearch: true }).kind).toBe('search-rejected');
    expect(describeDeviceLogError(transport, { hasSearch: false }).kind).toBe('generic');
  });

  it('keeps other bodiless failures during a search retryable: an outage is not the text', () => {
    for (const message of [
      'Relay fetch failed: 503 Service Unavailable',
      'Relay fetch failed: 5020 Odd',
      'Relay fetch failed: authentication temporarily unavailable (agentLogsContentQuery)',
    ]) {
      expect(describeDeviceLogError(new Error(message), { hasSearch: true }).kind).toBe('generic');
    }
  });

  it('keeps offline distinct so the UI can drop Retry', () => {
    expect(describeDeviceLogError(new OfflineError('deviceLogsRelayQuery'), { hasSearch: true }).kind).toBe('offline');
  });
});

describe('isRetryableDeviceLogError', () => {
  it('offers a resend only for outages — the one policy all three surfaces read', () => {
    expect(isRetryableDeviceLogError('unavailable')).toBe(true);
    expect(isRetryableDeviceLogError('generic')).toBe(true);
  });

  it('never for an answer about the request, which a resend gets again', () => {
    for (const kind of ['not-found', 'validation', 'search-rejected'] as const) {
      expect(isRetryableDeviceLogError(kind)).toBe(false);
    }
  });

  it('not for offline either: that waits for the link instead of a button', () => {
    expect(isRetryableDeviceLogError('offline')).toBe(false);
  });
});
