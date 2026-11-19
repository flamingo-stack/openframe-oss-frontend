/**
 * The session "Watch live" opens: another technician's running session on the device, read from the device's own
 * running sessions on a device page and from the tenant's on a table row; nothing while Watch live is off, the
 * item cannot show, or the only running session is this technician's own.
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantSessionRow } from '../components/remote-sessions/tenant-session-columns';
import type { TenantLiveSessionsFilter } from './use-tenant-live-sessions';
import { isWatchableSession, useWatchLiveSessionId } from './use-watch-live-session';

const hooks = vi.hoisted(() => ({
  gate: 'on' as 'on' | 'off' | 'loading',
  rows: [] as TenantSessionRow[],
  filters: [] as (TenantLiveSessionsFilter | null)[],
}));

vi.mock('./use-remote-session-watch-gate', () => ({ useRemoteSessionWatchGate: () => hooks.gate }));
// The poll itself (its key, interval and retries) is `useTenantLiveSessions`' own, covered by its test: here it answers
// at once with the running sessions, and only for a filter (null reads nothing).
vi.mock('./use-tenant-live-sessions', () => ({
  useTenantLiveSessions: (filter: TenantLiveSessionsFilter | null) => {
    hooks.filters.push(filter);
    return filter ? hooks.rows : null;
  },
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'tech-maria' } }),
}));

const row = (id: string, technicianId: string, machineId = 'machine-1', live = true) =>
  ({ id, technicianId, live, device: { machineId, name: machineId, hostname: null } }) as TenantSessionRow;

let container: HTMLDivElement;
let root: Root;
let sessionId: string | null;

function Probe({ scope, enabled }: { scope: 'device' | 'tenant'; enabled: boolean }) {
  const value = useWatchLiveSessionId('machine-1', { scope, enabled });
  useEffect(() => {
    sessionId = value;
  });
  return null;
}

function render(scope: 'device' | 'tenant', enabled = true) {
  act(() => root.render(<Probe scope={scope} enabled={enabled} />));
}

const lastFilter = () => hooks.filters.at(-1);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  hooks.gate = 'on';
  hooks.rows = [];
  hooks.filters = [];
  sessionId = null;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

describe('isWatchableSession', () => {
  it("is another technician's running session only", () => {
    expect(isWatchableSession({ live: true, technicianId: 'tech-ann' }, 'tech-maria')).toBe(true);
    expect(isWatchableSession({ live: true, technicianId: 'tech-maria' }, 'tech-maria')).toBe(false);
    expect(isWatchableSession({ live: false, technicianId: 'tech-ann' }, 'tech-maria')).toBe(false);
  });
});

describe('useWatchLiveSessionId', () => {
  it("on a device page reads the device's running sessions and returns another technician's", () => {
    hooks.rows = [row('mine', 'tech-maria'), row('theirs', 'tech-ann')];
    render('device');
    expect(lastFilter()).toEqual({ deviceIds: ['machine-1'] });
    expect(sessionId).toBe('theirs');
  });

  it("in a table row reads the tenant's running sessions and picks this device's", () => {
    hooks.rows = [row('elsewhere', 'tech-ann', 'machine-2'), row('here', 'tech-ann')];
    render('tenant');
    expect(lastFilter()).toEqual({});
    expect(sessionId).toBe('here');
  });

  it('is null when no running session on the device belongs to another technician', () => {
    hooks.rows = [row('mine', 'tech-maria'), row('elsewhere', 'tech-ann', 'machine-2')];
    render('tenant');
    expect(sessionId).toBeNull();
  });

  it('reads nothing while Watch live is off or loading', () => {
    hooks.rows = [row('theirs', 'tech-ann')];
    for (const gate of ['off', 'loading'] as const) {
      hooks.gate = gate;
      render('device');
      expect(lastFilter()).toBeNull();
      expect(sessionId).toBeNull();
    }
  });

  it('reads nothing where the item cannot show', () => {
    hooks.rows = [row('theirs', 'tech-ann')];
    render('tenant', false);
    expect(lastFilter()).toBeNull();
    expect(sessionId).toBeNull();
  });
});
