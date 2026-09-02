/**
 * Dedicated Auth API Client
 * Handles auth endpoints: /me, /oauth/*, /oauth/refresh
 * Uses SHARED_HOST_URL when provided; otherwise uses relative URLs.
 */

import { isSaasSharedMode } from './app-mode';
import { forceLogout } from './force-logout';
import { isAppShell } from './platform';
import {
  appendAttributionQueryParams,
  collectRegistrationAttribution,
  normalizeAttribution,
  type RegistrationAttribution,
} from './registration-attribution';
import { runtimeEnv } from './runtime-config';
import { refreshTokens } from './token-refresh-manager';
import { getAccessTokenSync, getRefreshToken, getTokenEpoch, isBearerAuthMode } from './token-store';

function getDomainSuffix(): string {
  const sharedUrl = runtimeEnv.sharedHostUrl();
  if (!sharedUrl) {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return parts.slice(-2).join('.');
      }
      return hostname;
    }
    return 'localhost';
  }

  const withoutProtocol = sharedUrl.replace(/^https?:\/\//, '');
  const domain = withoutProtocol.split('/')[0].split(':')[0];

  return domain || 'localhost';
}

export const SAAS_DOMAIN_SUFFIX = getDomainSuffix();

export interface AuthApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

function buildAuthUrl(path: string): string {
  const base = runtimeEnv.sharedHostUrl();
  if (!base) return path.startsWith('/') ? path : `/${path}`;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export interface SsoRegisterPayload {
  tenantName: string;
  tenantDomain: string;
  email: string;
  provider: 'google' | 'microsoft' | 'apple';
  redirectTo?: string;
  /**
   * Native shells only, and the counterpart of {@link AuthApiClient.loginUrl}'s
   * `authMobile`: the authz service stores it in the SSO registration cookie and
   * replays it on the `/oauth/continue` that logs the new owner in, so the
   * callback carries a devTicket even where the gateway has dev-ticket issuance
   * off (prod). Without it registration creates the tenant and the app gets a
   * ticket-less callback back.
   */
  authMobile?: boolean;
  /** Defaults to whatever is capturable right now; pass explicitly to reuse an existing set. */
  attribution?: RegistrationAttribution;
}

class AuthApiClient {
  /**
   * `sentAtEpoch` is the {@link getTokenEpoch} value captured before the request
   * went out; passing it lets a 401 raised under an already-replaced credential
   * retry instead of starting a second rotation. Omitted by callers outside
   * `request()`, which keeps the previous always-refresh behavior.
   */
  async handleUnauthorized<T>(
    url: string,
    headers: Record<string, string>,
    init: RequestInit,
    sentAtEpoch?: number,
  ): Promise<AuthApiResponse<T> | null> {
    // Mirror api-client: on the auth pages a 401 just means "not signed in
    // yet" — never refresh-or-force-logout from here. A stale 401 chain that
    // resolved after nativeLogin() stored fresh tokens used to forceLogout and
    // wipe the Keychain right after a successful mobile login.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
      return null;
    }

    const outcome = await refreshTokens(sentAtEpoch);

    if (outcome === 'transient') {
      // Not a rejected credential (5xx, WAF 403, dropped link, timeout) — fail
      // this request rather than ending a working session.
      return { data: undefined, error: 'Authentication temporarily unavailable', status: 0, ok: false };
    }

    if (outcome === 'refreshed') {
      // A copy, not a write into the caller's object: `headers` belongs to the
      // request that already failed, and the caller keeps using it afterwards.
      const newToken = isBearerAuthMode() ? getAccessTokenSync() : null;
      const retryHeaders = newToken ? { ...headers, Authorization: `Bearer ${newToken}` } : headers;

      const retryRes = await fetch(url, {
        credentials: 'include',
        headers: retryHeaders,
        ...init,
      });

      let retryData: T | undefined;
      const retryContentType = retryRes.headers.get('content-type') || '';
      if (retryContentType.includes('application/json')) {
        try {
          retryData = await retryRes.json();
        } catch {
          // A response that claims JSON but does not parse leaves `retryData` undefined, which the caller reads as "no body" — the HTTP status is what actually decides the outcome.
        }
      }

      return {
        data: retryData,
        error: retryRes.ok ? undefined : `Request failed with status ${retryRes.status}`,
        status: retryRes.status,
        ok: retryRes.ok,
      };
    }

    await forceLogout({ reason: 'Auth API Client - Token refresh failed' });
    return null;
  }

  /** No `tenantId` — the BFF resolves it from the refresh token. See `token-refresh-manager.ts`. */
  refresh<T = unknown>() {
    return requestRefresh<T>('/oauth/refresh', { method: 'POST' });
  }

  devExchange(ticket: string): Promise<Response> {
    const base = runtimeEnv.sharedHostUrl() || '';
    const url = `${base}/oauth/dev-exchange?ticket=${encodeURIComponent(ticket)}`;
    return fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  }

  oauth<T = unknown>(path: string, body?: unknown, init: RequestInit = {}) {
    return request<T>(`/oauth/${path.replace(/^\//, '')}`, {
      method: body ? 'POST' : init.method || 'GET',
      body: body ? JSON.stringify(body) : init.body,
      ...init,
    });
  }

  discoverTenants<T = unknown>(email: string) {
    const path = `/sas/tenant/discover?email=${encodeURIComponent(email)}`;
    return requestPublic<T>(path, { method: 'GET' });
  }

  checkDomainAvailability<T = unknown>(subdomain: string, organizationName: string) {
    const fullDomain = `${subdomain}.${SAAS_DOMAIN_SUFFIX}`;
    const path = `/api/tenant/availability?domain=${encodeURIComponent(fullDomain)}&organizationName=${encodeURIComponent(organizationName)}`;
    return requestPublic<T>(path, { method: 'GET' });
  }

  checkEmailAvailability<T = unknown>(email: string) {
    const path = `/sas/tenant/email-available?email=${encodeURIComponent(email)}`;
    return requestPublic<T>(path, { method: 'GET' });
  }

  resendVerificationEmail<T = unknown>(email: string) {
    const path = `/sas/email/verify/resend?email=${encodeURIComponent(email)}`;
    return requestPublic<T>(path, { method: 'POST' });
  }

  registerOrganization<T = unknown>(payload: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    tenantName: string;
    tenantDomain: string;
    prNumber?: number;
    /** Marketing-attribution signals (click ids, campaign labels, tracking cookies, event id). */
    attribution?: RegistrationAttribution;
  }) {
    // Same "omit, never send empty" treatment the SSO query serialization applies — an
    // explicit caller-supplied object must not smuggle blank strings into the JSON body.
    const { attribution, ...rest } = payload;
    const normalized = attribution ? normalizeAttribution(attribution) : undefined;
    return request<T>('/sas/oauth/register', {
      method: 'POST',
      body: JSON.stringify({ ...rest, ...(normalized ? { attribution: normalized } : {}) }),
    });
  }

  registerOrganizationSso(payload: SsoRegisterPayload) {
    window.location.href = this.registerSsoUrl(payload);

    return Promise.resolve({ ok: true, status: 302, data: null, error: null });
  }

  /**
   * The SSO tenant-registration entry point, as a URL. Split out of
   * {@link registerOrganizationSso} for the native shells, which must not
   * navigate to it: Capacitor hands a top-level https nav to the system
   * browser, so the tenant gets created in Safari and the app is left signed
   * out. They run this URL inside a shell-owned browser session instead — see
   * `nativeSsoRegister`.
   */
  registerSsoUrl(payload: SsoRegisterPayload): string {
    const params = new URLSearchParams({
      tenantName: payload.tenantName,
      tenantDomain: payload.tenantDomain,
      email: payload.email,
      provider: payload.provider,
    });

    if (payload.redirectTo) {
      params.append('redirectTo', payload.redirectTo);
    }

    if (payload.authMobile) {
      params.append('authMobile', 'true');
    }

    // The IdP callback is a fresh request from Google/Microsoft — the landing URL's click ids
    // and this browser's tracking cookies are unreachable by then. Send them now; the backend
    // stashes them in the SSO state cookie and replays them when the callback builds the
    // registration.
    const attribution = payload.attribution ?? collectRegistrationAttribution();
    if (attribution) {
      appendAttributionQueryParams(params, attribution);
    }

    return buildAuthUrl(`/sas/oauth/register/sso?${params.toString()}`);
  }

  getRegistrationProviders<T = unknown>() {
    return request<T>('/sas/sso/providers/registration', {
      method: 'GET',
    });
  }

  getInviteProviders<T = unknown>(invitationId: string) {
    return request<T>(`/sas/sso/providers/invite?invitationId=${encodeURIComponent(invitationId)}`, {
      method: 'GET',
    });
  }

  acceptInvitation<T = unknown>(payload: {
    invitationId: string;
    password: string;
    firstName: string;
    lastName: string;
    switchTenant?: boolean;
  }) {
    return request<T>('/sas/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        switchTenant: payload.switchTenant || false,
      }),
    });
  }

  acceptInvitationSso(payload: {
    invitationId: string;
    provider: 'openframe' | 'openframe-sso' | 'google' | 'microsoft' | 'apple';
    switchTenant?: boolean;
    redirectTo?: string;
  }) {
    const params = new URLSearchParams({
      invitationId: payload.invitationId,
      provider: payload.provider,
    });

    if (payload.switchTenant !== undefined) {
      params.append('switchTenant', payload.switchTenant.toString());
    }

    if (payload.redirectTo) {
      params.append('redirectTo', payload.redirectTo);
    }

    const url = buildAuthUrl(`/sas/invitations/accept/sso?${params.toString()}`);
    window.location.href = url;

    return Promise.resolve({ ok: true, status: 302, data: null, error: null });
  }

  confirmPasswordReset<T = unknown>(payload: { token: string; newPassword: string }) {
    return request<T>('/sas/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  requestPasswordReset<T = unknown>(payload: { email: string }) {
    return request<T>('/sas/password-reset/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** `redirectTo` is pre-encoded by the caller — it is interpolated as-is. */
  loginUrl(tenantId: string, redirectTo: string, provider?: string, options?: { authMobile?: boolean }) {
    // The built-in OpenFrame login has no provider param; 'openframe-sso' is its legacy id.
    const providerParam =
      provider && provider !== 'openframe' && provider !== 'openframe-sso'
        ? `&provider=${encodeURIComponent(provider)}`
        : '';
    const base = `/oauth/login?tenantId=${encodeURIComponent(tenantId)}${providerParam}`;
    // Shared mode drops a caller-supplied redirectTo — the shared auth host owns
    // where a browser lands after login. Both native shells are the exception:
    // each blocks on a callback it named itself, and the gateway only sends that
    // callback because of redirectTo, so dropping it doesn't degrade the login,
    // it hangs it forever. Both pass authMobile, so isAppShell() is belt and
    // braces here for any shell login that ever stops doing so.
    const keepRedirect = options?.authMobile || isAppShell() || !isSaasSharedMode();
    const path = `${base}${options?.authMobile ? '&authMobile=true' : ''}${keepRedirect ? `&redirectTo=${redirectTo}` : ''}`;
    return buildAuthUrl(path);
  }

  logout(tenantId?: string) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const logoutUrl = buildAuthUrl(`/oauth/logout${query}`);

    try {
      window.location.href = logoutUrl;
    } catch (_error) {
      window.location.assign(logoutUrl);
    }
  }

  async logoutAsync(tenantId?: string): Promise<boolean> {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const logoutUrl = buildAuthUrl(`/oauth/logout${query}`);
    const headers: Record<string, string> = {};

    // In bearer mode there is no refresh cookie — send the token so the
    // gateway can revoke it server-side.
    if (isBearerAuthMode()) {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        headers['Refresh-Token'] = refreshToken;
      }
    }

    try {
      await fetch(logoutUrl, {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual',
        headers,
      });
      return true;
    } catch {
      return false;
    }
  }
}

const authApiClient = new AuthApiClient();

async function requestRefresh<T = unknown>(path: string, init: RequestInit = {}): Promise<AuthApiResponse<T>> {
  const url = buildAuthUrl(path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (isBearerAuthMode()) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      headers['Refresh-Token'] = refreshToken;
    }
  }

  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers,
      ...init,
    });

    let data: T | undefined;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        // Same as above: `data` stays undefined and the status carries the result.
      }
    }

    if (isBearerAuthMode() && res.ok) {
      const accessToken = res.headers.get('Access-Token') || res.headers.get('access-token');
      const refreshToken = res.headers.get('Refresh-Token') || res.headers.get('refresh-token');

      if (accessToken || refreshToken) {
        data = {
          ...data,
          access_token: accessToken,
          refresh_token: refreshToken,
        } as T;
      }
    }

    return {
      data,
      error: res.ok ? undefined : `Request failed with status ${res.status}`,
      status: res.status,
      ok: res.ok,
    };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'Network error' };
  }
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<AuthApiResponse<T>> {
  const url = buildAuthUrl(path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (isBearerAuthMode()) {
    const token = getAccessTokenSync();
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  // Captured BEFORE the request goes out: a 401 that comes back after the
  // credential has already rotated needs a retry, not another rotation.
  const sentAtEpoch = getTokenEpoch();
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers,
      ...init,
    });

    if (res.status === 401) {
      const retryResult = await authApiClient.handleUnauthorized<T>(url, headers, init, sentAtEpoch);
      if (retryResult) {
        return retryResult;
      }
      return {
        data: undefined,
        error: 'Authentication failed - please login again',
        status: 401,
        ok: false,
      };
    }

    let data: T | undefined;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        // Same as above: `data` stays undefined and the status carries the result.
      }
    }

    return {
      data,
      error: res.ok ? undefined : `Request failed with status ${res.status}`,
      status: res.status,
      ok: res.ok,
    };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'Network error' };
  }
}

async function requestPublic<T = unknown>(path: string, init: RequestInit = {}): Promise<AuthApiResponse<T>> {
  const url = buildAuthUrl(path);
  try {
    const res = await fetch(url, {
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
      ...init,
    });

    let data: T | undefined;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        // Same as above: `data` stays undefined and the status carries the result.
      }
    }

    return {
      data,
      error: res.ok ? undefined : `Request failed with status ${res.status}`,
      status: res.status,
      ok: res.ok,
    };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export { authApiClient };

export type AuthApiResponseAlias<T = unknown> = AuthApiResponse<T>;
