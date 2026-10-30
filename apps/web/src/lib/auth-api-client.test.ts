/**
 * `authApiClient.authErrorMessage`: the one GraphQL call to the auth server, made by the error page
 * before anyone is signed in. Pins the wire shape (where it goes, what it carries, no credentials) and
 * how the envelope is unwrapped, so the page can treat `ok` as "safe to render".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApiClient, getAuthFailureMessage } from './auth-api-client';

vi.mock('./force-logout', () => ({ forceLogout: vi.fn(), clearStoredTokens: vi.fn() }));
const shell = vi.hoisted(() => ({ plugin: null as { revokeSession?: () => Promise<boolean> } | null }));
vi.mock('./native-shell', () => ({ nativeAuthPlugin: () => shell.plugin, nativeShellVersion: () => null }));
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

function htmlResponse(status: number) {
  return {
    ok: false,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null) },
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  };
}

beforeEach(() => {
  shell.plugin = null;
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

describe('authApiClient.requestDownloadLink', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('of_attr_utm_source', JSON.stringify({ v: 'reddit', t: Date.now() }));
  });

  it("posts the address, the honeypot and the visit's attribution to the shared host", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, headers: { get: () => null }, json: async () => undefined });

    const result = await authApiClient.requestDownloadLink({ email: 'kate@acme.com', website: '' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('https://auth.test/sas/tenant/download-link');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(init.body)) as {
      email: string;
      website: string;
      attribution: Record<string, string>;
    };
    expect(body.email).toBe('kate@acme.com');
    expect(body.website).toBe('');
    expect(body.attribution.utmSource).toBe('reddit');
    // Not a registration: no event id to pair with Meta's pixel.
    expect(body.attribution.eventId).toBeUndefined();
    expect(result).toEqual({ ok: true, status: 204, data: undefined, error: undefined });
  });
});

describe('getAuthFailureMessage', () => {
  const accept = () =>
    authApiClient.acceptInvitation({ invitationId: 'inv-1', firstName: 'Ann', lastName: 'Lee', password: 'x' });

  it("reads a rejected field's own messages instead of the field-prefixed summary", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_ERROR',
          message: 'firstName: Invalid first name, password: Password must contain at least one uppercase letter',
          fieldErrors: [
            { field: 'firstName', message: 'Invalid first name' },
            { field: 'lastName', message: 'Invalid last name' },
            { field: 'password', message: 'Password must contain at least one uppercase letter' },
          ],
        },
        400,
      ),
    );

    expect(getAuthFailureMessage(await accept(), 'Failed')).toBe(
      'Invalid first name. Invalid last name. Password must contain at least one uppercase letter.',
    );
  });

  it("shows a non-field rejection's message as the server wrote it", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'CONFLICT', message: 'Invitation already used or revoked' }, 409));

    expect(getAuthFailureMessage(await accept(), 'Failed')).toBe('Invitation already used or revoked');
  });

  it("explains the firewall's bare 502 instead of quoting the status", async () => {
    fetchMock.mockResolvedValue(htmlResponse(502));

    const message = getAuthFailureMessage(await accept(), 'Failed');

    expect(message).not.toContain('502');
    expect(message).toContain('remove characters such as < > or "');
  });

  it('says the server was not reached when the request never got an answer', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(getAuthFailureMessage(await accept(), 'Failed')).toBe(
      'Could not reach the server. Check your connection and try again.',
    );
  });

  it("falls back to the caller's text for a rejection that carries no message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'SOMETHING' }, 409));

    expect(getAuthFailureMessage(await accept(), 'Failed to accept invitation')).toBe('Failed to accept invitation');
  });
});

describe('authApiClient.logoutAsync', () => {
  it('leaves the revocation to a shell that keeps the refresh token, and sends nothing itself', async () => {
    const revokeSession = vi.fn().mockResolvedValue(true);
    shell.plugin = { revokeSession };

    await expect(authApiClient.logoutAsync('tenant-1')).resolves.toBe(true);

    expect(revokeSession).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a revocation the shell could not make', async () => {
    shell.plugin = { revokeSession: vi.fn().mockRejectedValue(new Error('no bridge')) };

    await expect(authApiClient.logoutAsync()).resolves.toBe(false);
  });

  it('asks the gateway itself everywhere else', async () => {
    shell.plugin = {};
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(authApiClient.logoutAsync('tenant-1')).resolves.toBe(true);

    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.test/oauth/logout?tenantId=tenant-1');
  });
});
