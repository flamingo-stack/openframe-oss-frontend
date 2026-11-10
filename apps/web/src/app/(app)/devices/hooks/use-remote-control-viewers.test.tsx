/**
 * Who the Remote Control header shows: only while somebody other than the host watches (the host alone, or the host
 * watching from a second tab, shows nothing), the host first and marked as you, then the watchers. Nothing with Watch
 * live off or once the session is over.
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSession, RemoteSessionViewerEntry } from '../types/remote-access';
import { useRemoteControlViewers } from './use-remote-control-viewers';

const hooks = vi.hoisted(() => ({
  gate: 'on' as 'on' | 'off' | 'loading',
  session: null as RemoteSession | null,
  ended: null as { endReason: null; endedAt: null } | null,
}));

vi.mock('./use-remote-session-watch-gate', () => ({ useRemoteSessionWatchGate: () => hooks.gate }));
vi.mock('../components/remote-access/remote-access-session-context', () => ({
  useRemoteAccessSession: () => ({ session: hooks.session, ended: hooks.ended }),
}));
vi.mock('./use-remote-session-chat', () => ({
  useRemoteSessionChatTechnician: () => ({ name: 'Maria Host', avatarUrl: 'https://cdn/maria.png' }),
}));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'tech-maria' } }),
}));

const DANA: RemoteSessionViewerEntry = { userId: 'tech-dana', name: 'Dana', avatarUrl: null };
const UNNAMED: RemoteSessionViewerEntry = { userId: 'tech-x', name: null, avatarUrl: null };
const HOST_TAB: RemoteSessionViewerEntry = { userId: 'tech-maria', name: 'Maria Host', avatarUrl: null };

const session = (viewers: RemoteSessionViewerEntry[], status: RemoteSession['status'] = 'ACTIVE'): RemoteSession => ({
  sessionId: 'session-1',
  requestId: 'request-1',
  technicianId: 'tech-maria',
  sessionKind: 'desktop',
  status,
  startedAt: '2026-11-10T09:00:00.000Z',
  dialogId: null,
  viewers,
});

let container: HTMLDivElement;
let root: Root;
let result: ReturnType<typeof useRemoteControlViewers>;

function Probe() {
  const value = useRemoteControlViewers();
  useEffect(() => {
    result = value;
  });
  return null;
}

function render() {
  act(() => root.render(<Probe />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  hooks.gate = 'on';
  hooks.session = null;
  hooks.ended = null;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useRemoteControlViewers', () => {
  it('lists the host first, marked as you, then those watching', () => {
    hooks.session = session([HOST_TAB, DANA, UNNAMED]);
    render();
    expect(result).toEqual([
      { id: 'tech-maria', name: 'Maria Host', avatarUrl: 'https://cdn/maria.png', isHost: true, isYou: true },
      { id: 'tech-dana', name: 'Dana', avatarUrl: null, isYou: false },
      { id: 'tech-x', name: 'Technician', avatarUrl: null, isYou: false },
    ]);
  });

  it('shows nothing while only the host is there, from this tab or another', () => {
    hooks.session = session([]);
    render();
    expect(result).toEqual([]);
    hooks.session = session([HOST_TAB]);
    render();
    expect(result).toEqual([]);
  });

  it('shows nothing with Watch live off, before the session is known, or once it is over', () => {
    hooks.gate = 'off';
    hooks.session = session([DANA]);
    render();
    expect(result).toEqual([]);

    hooks.gate = 'on';
    hooks.session = null;
    render();
    expect(result).toEqual([]);

    hooks.session = session([DANA], 'ENDED');
    render();
    expect(result).toEqual([]);

    hooks.session = session([DANA]);
    hooks.ended = { endReason: null, endedAt: null };
    render();
    expect(result).toEqual([]);
  });
});
