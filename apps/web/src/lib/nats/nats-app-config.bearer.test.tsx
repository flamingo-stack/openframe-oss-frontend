import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_KEY, setTokens } from '@/lib/token-store';
import { type NatsAppConfig, NatsAppConfigProvider, useNatsAppConfig } from './nats-app-config';

vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ isAuthenticated: true, user: { id: 'u1' } }),
}));
vi.mock('@/lib/runtime-config', () => ({
  runtimeEnv: { tenantHostUrl: () => 'http://tenant.test', enableDevTicketObserver: () => true },
}));
vi.mock('@/lib/api-client', () => ({ apiClient: { me: vi.fn() } }));

let container: HTMLDivElement;
let root: Root;
let latest: NatsAppConfig | null = null;

function Probe() {
  const config = useNatsAppConfig();
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = config;
  });
  return null;
}

describe('NATS config in web bearer mode', () => {
  beforeEach(() => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'OLD');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <NatsAppConfigProvider>
          <Probe />
        </NatsAppConfigProvider>,
      );
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    latest = null;
  });

  // The store writes localStorage and fires no `storage` event in the same tab.
  // When urlRevision missed that, getWsUrl() moved to the new token while the
  // provider's connection stayed keyed on the old URL: the lib declined to dial
  // a URL it no longer wanted, nothing re-acquired, and NATS stayed down.
  it('moves urlRevision and getWsUrl together when the store rotates with no React update', async () => {
    expect(latest?.getWsUrl()).toContain('OLD');
    const before = latest?.urlRevision;

    await act(async () => {
      await setTokens({ accessToken: 'NEW' });
    });

    expect(latest?.getWsUrl()).toContain('NEW');
    expect(latest?.urlRevision).not.toBe(before);
    expect(latest?.urlRevision).toContain('NEW');
  });
});
