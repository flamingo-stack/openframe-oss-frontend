/**
 * Centralized API Client Configuration
 * Handles both cookie-based and header-based authentication automatically
 */

interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  /**
   * Issue the request without waiting for either bootstrap latch — the session
   * one (`session-ready.ts`) or the subscription one (`subscription-gate.ts`).
   *
   * ONLY for the two calls that establish those answers in the first place:
   * `/me` and the feature-flags query. Anything else would fetch before `/me`
   * has answered, or during server rendering where there is no user at all —
   * and the feature-flags query is what tells the subscription guard whether to
   * ask at all, so gating it on the guard's answer would deadlock both.
   */
  skipSessionGate?: boolean;
  /**
   * Ceiling on this request, in ms. `0` disables it. Defaults to
   * {@link REQUEST_TIMEOUT_MS}.
   */
  timeoutMs?: number;
}

/**
 * How long a single request may run before it is aborted as failed.
 *
 * `fetch` has no timeout of its own, and neither React Query nor Relay adds one:
 * a connection the server accepts and then never answers on stays pending for as
 * long as the OS keeps the socket — minutes, or until the tab is closed. Every
 * loading state in the app is downstream of a request settling, so "never
 * settles" surfaces as a skeleton that never resolves, with no error, no retry
 * and nothing in the console. That failure mode is not hypothetical here: it is
 * the same shape as the chrome skeleton that outlived its own cause, and it can
 * appear behind ANY spinner in the app rather than one specific one.
 *
 * A timeout converts it into an ordinary failed request — which every caller
 * already handles, because that is the same path a 500 takes: React Query
 * retries and then reports an error, Relay's observable errors into the nearest
 * boundary, and `useToast` says so.
 *
 * 30s is chosen to sit above the slowest healthy request here (the wide Fleet and
 * device queries) and well below a user's patience. Long-running transfers do NOT
 * ride this client — uploads and attachment downloads use raw `fetch`, and
 * MeshCentral streams over WebSockets with its own per-operation timeouts — so
 * this ceiling never truncates one.
 */
const REQUEST_TIMEOUT_MS = 30_000;

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

import { forceLogout } from './force-logout';
import { runtimeEnv } from './runtime-config';
import { waitForSessionReady } from './session-ready';
import { waitForSubscriptionGate } from './subscription-gate';
import { refreshAccessToken } from './token-refresh-manager';
import { getAccessTokenSync, getTokenEpoch, isBearerAuthMode } from './token-store';

class ApiClient {
  /**
   * Get authentication headers based on current configuration
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // In bearer mode (dev-ticket web or native shell), attach the stored token
    if (isBearerAuthMode()) {
      const accessToken = getAccessTokenSync();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return headers;
  }

  /**
   * Build full URL from path
   */
  private buildUrl(path: string): string {
    // Absolute URLs pass through
    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    const tenantHost = runtimeEnv.tenantHostUrl();

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (tenantHost) return `${tenantHost}${cleanPath}`;

    // Default: use relative path (no host)
    return cleanPath;
  }

  /**
   * Force logout the user using unified logout utility
   */
  private async forceLogout(): Promise<void> {
    await forceLogout({
      reason: 'API Client - Authentication failure',
    });
  }

  /**
   * Make an authenticated API request
   */
  async request<T = any>(
    path: string,
    options: ApiRequestOptions = {},
    isRetry: boolean = false,
  ): Promise<ApiResponse<T>> {
    const {
      skipAuth = false,
      skipSessionGate = false,
      timeoutMs = REQUEST_TIMEOUT_MS,
      headers = {},
      ...fetchOptions
    } = options;

    // App data waits for the session; the bootstrap pair opts out. Retries keep
    // whatever the first attempt decided (the latch is already open by then).
    if (!skipSessionGate && !isRetry) {
      await waitForSessionReady();
      // ...and then for the subscription answer. Most of the app's GraphQL
      // traffic still goes out through here rather than through Relay (customers,
      // devices, logs, tickets, monitoring, dashboard), so gating only the Relay
      // network layer left the larger half of the requests firing into a locked
      // workspace. See `subscription-gate.ts`.
      await waitForSubscriptionGate();
    }

    // Build headers
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers, // Custom headers from caller
    };

    // Add auth headers unless explicitly skipped
    if (!skipAuth) {
      Object.assign(requestHeaders, this.getAuthHeaders());
    }

    // Build full URL
    const url = this.buildUrl(path);

    // Captured BEFORE the request goes out: a 401 that comes back after the
    // credential has already rotated needs a retry, not another rotation.
    const sentAtEpoch = getTokenEpoch();

    // Own controller rather than `AbortSignal.timeout()`, for two reasons: a
    // caller-supplied signal still has to be honored (chained below), and the
    // `timedOut` flag is what lets the catch tell a timeout apart from a
    // deliberate cancellation — they abort identically but mean opposite things
    // to the caller.
    const timeoutController = timeoutMs > 0 ? new AbortController() : undefined;
    let timedOut = false;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    if (timeoutController) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
      }, timeoutMs);

      const callerSignal = fetchOptions.signal;
      if (callerSignal) {
        if (callerSignal.aborted) timeoutController.abort();
        else callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
      }
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        credentials: 'include', // Always include cookies for cookie-based auth
        signal: timeoutController?.signal ?? fetchOptions.signal,
      });

      // Handle 401 Unauthorized - attempt token refresh ONLY ONCE
      if (response.status === 401 && !skipAuth && !isRetry) {
        // Check if on auth page - skip refresh/logout to prevent loops
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        const isAuthPage = currentPath.startsWith('/auth');

        if (isAuthPage) {
          return {
            data: undefined,
            error: 'Unauthorized',
            status: 401,
            ok: false,
          };
        }

        // No local queue: `refreshAccessToken` is already single-flight, so a
        // concurrent 401 joins the in-flight rotation instead of starting one,
        // and a 401 that lands after it finished short-circuits on `sentAtEpoch`
        // to a plain retry. Parking these in an ApiClient-owned queue meant only
        // an ApiClient-driven refresh could release them — when the rotation was
        // started by Relay, the chat adapter, auth-api-client or the MeshCentral
        // socket (all sharing this same flag), nothing drained the queue and the
        // caller's promise never settled, hanging its react-query `queryFn`.
        const refreshSuccess = await refreshAccessToken(sentAtEpoch);

        if (refreshSuccess) {
          return this.request<T>(path, options, true);
        }

        await this.forceLogout();

        return {
          error: 'Authentication failed - please login again',
          status: 401,
          ok: false,
        };
      }

      // Parse response
      let data: T | undefined;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        try {
          data = await response.json();
        } catch (error) {
          console.error('[API Client] Failed to parse JSON response:', error);
        }
      }

      // Extract error message from response body if available
      let errorMessage: string | undefined;
      if (!response.ok) {
        const errorData = data as any;
        errorMessage = errorData?.message || errorData?.error || `Request failed with status ${response.status}`;
      }

      return {
        data,
        error: errorMessage,
        status: response.status,
        ok: response.ok,
      };
    } catch (error) {
      // Aborted requests should never trigger auth refresh or logout
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Our own ceiling fired: report it as the failure it is, so the caller
        // shows an error and React Query retries. A caller-driven cancellation
        // keeps the quieter message — nobody is waiting on it.
        return {
          error: timedOut ? `Request timed out after ${timeoutMs}ms` : 'Request aborted',
          status: 0,
          ok: false,
        };
      }

      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
        ok: false,
      };
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }

  /**
   * Convenience methods for common HTTP methods
   */
  async get<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T = any>(path: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(path: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = any>(path: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Special method for requests to external APIs (non-base URL)
   */
  async external<T = any>(url: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, options);
  }

  me<T = any>() {
    // Bootstrap call: this is what opens the session latch.
    return this.request<T>('/api/me', { skipSessionGate: true });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Export instance and class
export { apiClient, ApiClient };
export type { ApiResponse, ApiRequestOptions };
