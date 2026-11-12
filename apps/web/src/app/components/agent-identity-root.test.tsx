/**
 * The agents' identities are provided at the root, so a mark drawn outside `(app)` — a
 * Mingo notification popup, rendered by the root layout's notifications provider — has
 * its provider: no "[AgentIdentity] … with no <AgentIdentityProvider>" error, and no read
 * before the session is in place. And the read carries the session's credential with nothing
 * under `(app)` loaded, as on `/auth`: the root layout registers the auth adapter.
 */

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { runtimeEnv } from '@/lib/runtime-config';
import { AppAgentIdentityProvider } from './agent-identity-root';
// The root layout renders this ahead of the provider tree: its module registers the app's auth adapter.
import './embed-shim-registration';

const { session } = vi.hoisted(() => ({ session: { isReady: false, isAuthenticated: false } }));
vi.mock('@/app/(auth)/auth/hooks/use-auth-session', () => ({ useAuthSession: () => session }));

// A shell: the gateway is another origin, called absolute, and the credential is a bearer.
const TENANT_HOST = vi.hoisted(() => 'https://tenant.example.com');
vi.mock('@/app/(app)/help-center/endpoints', () => ({ CONTENT_ORIGIN: TENANT_HOST }));
vi.mock('@/lib/runtime-config', async importOriginal => {
  const actual = await importOriginal<{ runtimeEnv: typeof runtimeEnv }>();
  return { ...actual, runtimeEnv: { ...actual.runtimeEnv, tenantHostUrl: () => TENANT_HOST } };
});
vi.mock('@/lib/token-store', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getBearerTokenSync: () => 'token',
  isBearerAuthMode: () => true,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  session.isReady = false;
  session.isAuthenticated = false;
  vi.restoreAllMocks();
});

function render(withProvider: boolean) {
  const mark = <AgentMark agent="mingo" />;
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        {withProvider ? <AppAgentIdentityProvider>{mark}</AppAgentIdentityProvider> : mark}
      </QueryClientProvider>,
    ),
  );
}

const identityErrors = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(call => String(call[0]).includes('[AgentIdentity]'));

describe('AppAgentIdentityProvider', () => {
  it('provides the mark drawn under it, and reads nothing before the session', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(true);

    expect(identityErrors(error)).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is what a mark without it misses (the popup case before the move)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(false);
    expect(identityErrors(error)).not.toHaveLength(0);
  });

  it('reads the identities with the bearer, with nothing under (app) loaded', async () => {
    session.isReady = true;
    session.isAuthenticated = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ agents: [] }), { status: 200 }));

    render(true);
    await act(() => vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled()));

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(`${TENANT_HOST}/content/api/ai-agents`);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
    // A production build refuses a gateway the adapter did not sanction; outside one the lib only warns.
    expect(warn.mock.calls.filter(call => String(call[0]).includes('cross-origin'))).toHaveLength(0);
  });
});
