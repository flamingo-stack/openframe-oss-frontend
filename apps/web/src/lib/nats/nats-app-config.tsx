'use client';

import { buildNatsWsUrl } from '@flamingo-stack/openframe-frontend-core';
import {
  NATS_DEFAULTS,
  type NatsBeforeReconnect,
  type NatsReconnectContext,
  type NatsReconnectVerdict,
} from '@flamingo-stack/openframe-frontend-core/nats';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { forceLogout } from '@/lib/force-logout';
import { runtimeEnv } from '@/lib/runtime-config';
import { isPausedFor, isSessionGone } from '@/lib/session-health';
import { refreshTokens } from '@/lib/token-refresh-manager';
import { ACCESS_TOKEN_KEY, getAccessTokenSync, isBearerAuthMode, subscribeToTokenChange } from '@/lib/token-store';

function getApiBaseUrl(): string | null {
  const envBase = runtimeEnv.tenantHostUrl();
  if (envBase) return envBase;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return null;
}

function getAccessToken(): string | null {
  return getAccessTokenSync();
}

/**
 * A forced rotation changes the bearer, and in bearer mode the bearer is in the
 * URL: the provider then acquires a NEW connection with no failure history, which
 * would hit the threshold again within seconds and rotate again. The cooldown is
 * what bounds that — each rotation retires the previous refresh token.
 */
const FORCED_REFRESH_COOLDOWN_MS = 30 * 60_000;
let lastForcedRefreshAt = Number.NEGATIVE_INFINITY;

/**
 * Whether dialling is worth it, as session health sees it. A session paused as
 * `rejected` is not asked again: `/api/me` would 401 and refresh, and in bearer
 * mode that rotation moves the URL to a fresh connection that dials at once and
 * lands back here — a rotation per cycle. The dial itself costs no rotation, and
 * the refused path may not be this one, so it goes ahead: the connection's own
 * auto-pause bounds it. Otherwise one `/api/me` decides, and its answer has
 * already gone through apiClient: a deleted tenant is `gone`, and a 401 that
 * survived apiClient's own refresh-and-retry is a pause.
 */
export async function decideReconnect({ consecutiveFailures }: NatsReconnectContext): Promise<NatsReconnectVerdict> {
  if (isSessionGone()) return 'terminal';
  if (isPausedFor('rejected')) return 'continue';

  const me = await apiClient.me().catch(() => null);
  if (!me) return 'continue';
  if (isSessionGone()) return 'terminal';
  if (me.status === 401) return 'pause';
  if (me.ok && consecutiveFailures >= NATS_DEFAULTS.PAUSE_AFTER_FAILURES) {
    // The session is alive and the dial still fails: one forced rotation in case
    // the socket is refusing a token the REST API accepts, then stop dialling.
    if (Date.now() - lastForcedRefreshAt >= FORCED_REFRESH_COOLDOWN_MS) {
      lastForcedRefreshAt = Date.now();
      // As apiClient does: a rejected refresh has already cleared the tokens.
      if ((await refreshTokens()) === 'terminal') await forceLogout({ reason: 'NATS - forced token refresh failed' });
    }
    return 'pause';
  }
  return 'continue';
}

export interface NatsAppConfig {
  getWsUrl: () => string | null;
  onBeforeReconnect: NatsBeforeReconnect;
  urlRevision: string;
  isAuthenticated: boolean;
  userId: string | null;
}

const NatsAppConfigContext = createContext<NatsAppConfig | null>(null);

function getBearerSnapshot(): string | null {
  return isBearerAuthMode() ? getAccessToken() : null;
}

function getServerBearerSnapshot(): string | null {
  return null;
}

// Web: a rotation in ANOTHER tab arrives as a `storage` event, one in this tab
// as the store's own emit. Native tokens never touch localStorage, so only the
// emit fires there.
function subscribeToBearer(onChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === ACCESS_TOKEN_KEY) onChange();
  };
  window.addEventListener('storage', handler);
  const unsubscribe = subscribeToTokenChange(onChange);
  return () => {
    window.removeEventListener('storage', handler);
    unsubscribe();
  };
}

function useNatsAppConfigState(): NatsAppConfig {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const userId = useAuthStore(s => s.user?.id) ?? null;

  const [apiBaseUrl] = useState<string | null>(getApiBaseUrl);
  const isDevTicketEnabled = isBearerAuthMode();
  // The same store getWsUrl reads, so the revision cannot lag the URL: it moves
  // on every write the store announces, and the provider re-acquires with it.
  const token = useSyncExternalStore(subscribeToBearer, getBearerSnapshot, getServerBearerSnapshot);

  // The bearer is read from the token store here, not from `token` state: the lib
  // asks for a fresh URL straight after `onBeforeReconnect` resolves, before React
  // has re-rendered, and a state-backed closure would still hand back the URL of
  // the token that was just refused.
  const getWsUrl = useCallback((): string | null => {
    if (!isAuthenticated || !userId) return null;
    if (!apiBaseUrl) return null;
    const bearer = isDevTicketEnabled ? getAccessToken() : null;
    if (isDevTicketEnabled && !bearer) return null;
    return buildNatsWsUrl(apiBaseUrl, {
      token: bearer || undefined,
      includeAuthParam: isDevTicketEnabled,
      source: 'dashboard',
    });
  }, [apiBaseUrl, isDevTicketEnabled, isAuthenticated, userId]);

  const tokenForRevision = token ?? '';
  const urlRevision = useMemo(
    () =>
      `${isAuthenticated ? '1' : '0'}|${userId ?? ''}|${apiBaseUrl ?? ''}|${isDevTicketEnabled ? '1' : '0'}|${tokenForRevision}`,
    [isAuthenticated, userId, apiBaseUrl, isDevTicketEnabled, tokenForRevision],
  );

  return useMemo(
    () => ({ getWsUrl, onBeforeReconnect: decideReconnect, urlRevision, isAuthenticated, userId }),
    [getWsUrl, urlRevision, isAuthenticated, userId],
  );
}

export function NatsAppConfigProvider({ children }: { children: ReactNode }) {
  const value = useNatsAppConfigState();
  return <NatsAppConfigContext.Provider value={value}>{children}</NatsAppConfigContext.Provider>;
}

export function useNatsAppConfig(): NatsAppConfig {
  const ctx = useContext(NatsAppConfigContext);
  if (!ctx) {
    throw new Error('useNatsAppConfig must be used inside <NatsAppConfigProvider> (mounted by <NatsAppProvider>)');
  }
  return ctx;
}
