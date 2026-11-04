/**
 * The agents' identities are provided at the root, so a mark drawn outside `(app)` — a
 * Mingo notification popup, rendered by the root layout's notifications provider — has
 * its provider: no "[AgentIdentity] … with no <AgentIdentityProvider>" error, and no read
 * before the session is in place.
 */

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppAgentIdentityProvider } from './agent-identity-root';

const { session } = vi.hoisted(() => ({ session: { isReady: false, isAuthenticated: false } }));
vi.mock('@/app/(auth)/auth/hooks/use-auth-session', () => ({ useAuthSession: () => session }));

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
});
