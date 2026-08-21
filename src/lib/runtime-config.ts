import { env } from 'next-runtime-env';
import { APP_SCHEME, getStoredTenantHost } from './native-shell';

function getEnvVar(key: string): string | undefined {
  try {
    const value = env(key);
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value;
  } catch {
    if (typeof window !== 'undefined' && (window as any).process?.env) {
      return (window as any).process.env[key];
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    return undefined;
  }
}

export const runtimeEnv = {
  tenantHostUrl(): string {
    // Native shell: a host learned at login (callback origin, server-resolved
    // from the tenant registry) backs up the build-time value so one binary
    // can serve any tenant.
    return getEnvVar('NEXT_PUBLIC_TENANT_HOST_URL') || getStoredTenantHost() || '';
  },
  sharedHostUrl(): string {
    return getEnvVar('NEXT_PUBLIC_SHARED_HOST_URL') || '';
  },
  /**
   * OAuth callback scheme for the native shells. Per-env MOBILE builds
   * (stage/dev) override it so side-by-side installs don't fight over one
   * scheme — the value must match the shell's Info.plist / manifest
   * registration for the same env (iOS: OPENFRAME_URL_SCHEME build setting).
   * The desktop shell injects no override: it registers no scheme with the OS,
   * and the default is the one the gateway allow-lists in every environment.
   */
  appScheme(): string {
    return getEnvVar('NEXT_PUBLIC_MOBILE_APP_SCHEME') || APP_SCHEME;
  },
  gtmContainerId(): string | undefined {
    return getEnvVar('NEXT_PUBLIC_GTM_CONTAINER_ID');
  },
  appMode(): string {
    const mode = getEnvVar('NEXT_PUBLIC_APP_MODE');
    return mode || 'oss-tenant';
  },
  appType(): string {
    return getEnvVar('NEXT_PUBLIC_APP_TYPE') || 'openframe-dashboard';
  },
  appUrl(): string {
    return getEnvVar('NEXT_PUBLIC_APP_URL') || 'https://openframe.dev';
  },
  devUrl(): string {
    return getEnvVar('NEXT_PUBLIC_DEV_URL') || 'http://localhost:4000';
  },
  enableDevTicketObserver(): boolean {
    return (getEnvVar('NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER') || 'false') === 'true';
  },
  /** Shows the optional PR Number field on the signup form (dev environments only). */
  prNumberEnabled(): boolean {
    return (getEnvVar('NEXT_PUBLIC_PR_NUMBER_ENABLED') || 'false') === 'true';
  },
  authCheckIntervalMs(): number {
    const raw = getEnvVar('NEXT_PUBLIC_AUTH_CHECK_INTERVAL') || '300000';
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 300000;
  },
  authLoginUrl(): string {
    return getEnvVar('NEXT_PUBLIC_SHARED_HOST_URL') || '';
  },
  /** Tenant the native shell logs into — baked into the mobile bundle at build time. */
  mobileTenantId(): string {
    return getEnvVar('NEXT_PUBLIC_MOBILE_TENANT_ID') || '';
  },
};
