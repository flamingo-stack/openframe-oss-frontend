import { describe, expect, it } from 'vitest';
import { OfflineError } from '@/lib/query-state';
import { describeDeviceLogError, getGraphqlErrorCode } from './device-log-errors';

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

describe('getGraphqlErrorCode', () => {
  it('returns the first coded entry and ignores the non-null noise', () => {
    expect(getGraphqlErrorCode(relayError('DEVICE_NOT_FOUND', 'Machine not found: x'))).toEqual({
      code: 'DEVICE_NOT_FOUND',
      message: 'Machine not found: x',
    });
  });

  it('is null for errors without a GraphQL body', () => {
    expect(getGraphqlErrorCode(new Error('Relay fetch failed: 502 Bad Gateway'))).toBeNull();
    expect(getGraphqlErrorCode(null)).toBeNull();
  });
});

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

  it('keeps offline distinct so the UI can drop Retry', () => {
    expect(describeDeviceLogError(new OfflineError('deviceLogsRelayQuery'), { hasSearch: true }).kind).toBe('offline');
  });
});
