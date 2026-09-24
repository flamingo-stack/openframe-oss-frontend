// `getRelayErrorCode` decides which state a failed Relay request renders, and it
// reads whatever the network layer threw — so garbage must yield null, never a
// throw, and graphql-java's uncoded non-null follow-up must never win.
import { describe, expect, it } from 'vitest';
import { getRelayErrorCode } from './handle-api-error';

const withErrors = (errors: unknown) => Object.assign(new Error('No data returned'), { source: { errors } });

describe('getRelayErrorCode', () => {
  it('returns the first CODED entry, even behind an uncoded one', () => {
    const error = withErrors([
      { message: "The field at path '/deviceLogs' was declared as a non null type", extensions: {} },
      { message: 'Machine not found: x', extensions: { code: 'DEVICE_NOT_FOUND' } },
    ]);
    expect(getRelayErrorCode(error)).toEqual({ code: 'DEVICE_NOT_FOUND', message: 'Machine not found: x' });
  });

  it('keeps the code when the message is missing', () => {
    expect(getRelayErrorCode(withErrors([{ extensions: { code: 'LOKI_QUERY_ERROR' } }]))).toEqual({
      code: 'LOKI_QUERY_ERROR',
      message: '',
    });
  });

  it('is null for errors without a GraphQL body', () => {
    expect(getRelayErrorCode(new Error('Relay fetch failed: 502 Bad Gateway'))).toBeNull();
    expect(getRelayErrorCode(null)).toBeNull();
    expect(getRelayErrorCode('offline')).toBeNull();
  });

  it('survives malformed bodies instead of throwing', () => {
    expect(getRelayErrorCode(withErrors('not a list'))).toBeNull();
    expect(getRelayErrorCode(withErrors([null, 42, { extensions: null }, { extensions: { code: 7 } }]))).toBeNull();
  });
});
