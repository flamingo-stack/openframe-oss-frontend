/**
 * Remote Control on a device another technician is in: with Watch live on, the busy answer looks up the device's
 * running session and replaces the page with its live session page; the busy screen waits for the lookup and shows as
 * before when there is nothing to watch.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantSessionRow } from '../components/remote-sessions/tenant-session-columns';
import { useBusyDeviceLiveSession } from './use-busy-device-live-session';

const hooks = vi.hoisted(() => ({
  gate: 'on' as 'on' | 'off' | 'loading',
  read: vi.fn<(filter: object) => Promise<TenantSessionRow[]>>(),
  replace: vi.fn(),
}));

vi.mock('./use-remote-session-watch-gate', () => ({ useRemoteSessionWatchGate: () => hooks.gate }));
vi.mock('./use-tenant-live-sessions', () => ({ readLiveSessions: (filter: object) => hooks.read(filter) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: hooks.replace }) }));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'tech-maria' } }),
}));

const row = (id: string, technicianId: string, live = true) => ({ id, technicianId, live }) as TenantSessionRow;

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let looking: boolean;

function Probe({ busy }: { busy: boolean }) {
  const value = useBusyDeviceLiveSession('machine-1', busy).looking;
  useEffect(() => {
    looking = value;
  });
  return null;
}

async function render(busy: boolean) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe busy={busy} />
      </QueryClientProvider>,
    );
  });
  // The lookup settles a few ticks later (react-query notifies on its own schedule).
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  hooks.gate = 'on';
  client = new QueryClient();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  vi.clearAllMocks();
});

describe('useBusyDeviceLiveSession', () => {
  it("opens the live page of another technician's running session on the device", async () => {
    hooks.read.mockResolvedValue([row('mine', 'tech-maria'), row('dana-session', 'tech-dana')]);
    await render(true);
    expect(hooks.read).toHaveBeenCalledWith({ deviceIds: ['machine-1'] });
    expect(hooks.replace).toHaveBeenCalledWith('/devices/details/live-session?id=dana-session');
    expect(looking).toBe(true);
  });

  it('leaves the busy screen as it was when there is nothing to watch, or the lookup failed', async () => {
    hooks.read.mockResolvedValue([row('mine', 'tech-maria'), row('ended', 'tech-dana', false)]);
    await render(true);
    expect(hooks.replace).not.toHaveBeenCalled();
    expect(looking).toBe(false);

    client.clear();
    hooks.read.mockRejectedValue(new Error('network'));
    act(() => root.unmount());
    root = createRoot(container);
    await render(true);
    expect(hooks.replace).not.toHaveBeenCalled();
    expect(looking).toBe(false);
  });

  it('looks nothing up while the device is not busy or Watch live is off', async () => {
    await render(false);
    hooks.gate = 'off';
    await render(true);
    expect(hooks.read).not.toHaveBeenCalled();
    expect(looking).toBe(false);
  });
});
