/**
 * Centralized API Client Configuration
 * Handles both cookie-based and header-based authentication automatically
 */

interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

import { forceLogout } from './force-logout';
import { runtimeEnv } from './runtime-config';
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
    const { skipAuth = false, headers = {}, ...fetchOptions } = options;

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

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        credentials: 'include', // Always include cookies for cookie-based auth
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
        return {
          error: 'Request aborted',
          status: 0,
          ok: false,
        };
      }

      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
        ok: false,
      };
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
    return this.request<T>('/api/me');
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Export instance and class
export { apiClient, ApiClient };
export type { ApiResponse, ApiRequestOptions };
