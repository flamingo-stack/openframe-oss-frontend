/**
 * `authApiClient.authErrorMessage`: the one GraphQL call to the auth server, made by the error page
 * before anyone is signed in. Pins the wire shape (where it goes, what it carries, no credentials) and
 * how the envelope is unwrapped, so the page can treat `ok` as "safe to render".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApiClient } from './auth-api-client';

vi.mock('./force-logout', () => ({ forceLogout: vi.fn(), clearStoredTokens: vi.fn() }));
vi.mock('./native-shell', () => ({ nativeAuthPlugin: () => null, nativeShellVersion: () => null }));
vi.mock('./platform', () => ({ isAppShell: () => false, mobilePlatform: () => null, shellKind: () => 'web' }));
vi.mock('./runtime-config', () => ({
  runtimeEnv: { sharedHostUrl: () => 'https://auth.test', tenantHostUrl: () => '' },
}));
vi.mock('./token-refresh-manager', () => ({ refreshTokens: vi.fn() }));
vi.mock('./token-store', () => ({
  isBearerAuthMode: () => false,
  getAccessTokenSync: () => null,
  getRefreshToken: () => null,
  getTokenEpoch: () => 0,
}));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authApiClient.authErrorMessage', () => {
  it('posts the query to the shared host without credentials and unwraps the answer', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { authErrorMessage: { code: 'SSO_SESSION_EXPIRED', message: 'SSO session expired. Please try again.' } },
      }),
    );

    const result = await authApiClient.authErrorMessage('SSO_SESSION_EXPIRED');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('https://auth.test/sas/graphql');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(init.body)) as { query: string; variables: { reference: string } };
    expect(body.query).toContain('authErrorMessage(reference: $reference)');
    expect(body.variables).toEqual({ reference: 'SSO_SESSION_EXPIRED' });

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { code: 'SSO_SESSION_EXPIRED', message: 'SSO session expired. Please try again.' },
    });
  });

  it('reports a GraphQL error as not ok, with its message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: null, errors: [{ message: 'reference must not be empty' }] }));

    const result = await authApiClient.authErrorMessage('');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('reference must not be empty');
    expect(result.data).toBeUndefined();
  });

  it('reports an HTTP failure and a network failure as not ok', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));
    expect(await authApiClient.authErrorMessage('SSO_SESSION_EXPIRED')).toMatchObject({ ok: false, status: 503 });

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await authApiClient.authErrorMessage('SSO_SESSION_EXPIRED')).toEqual({
      ok: false,
      status: 0,
      error: 'Failed to fetch',
    });
  });
});
