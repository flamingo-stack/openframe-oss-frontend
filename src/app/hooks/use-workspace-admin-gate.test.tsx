// Pins the tri-state and the role list: "not answered yet" and "signed out" are `loading`,
// never `denied`; OWNER and ADMIN are in, in any casing; everyone else is out.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceAdminGate } from './use-workspace-admin-gate';

type Session = { isReady: boolean; isAuthenticated: boolean; user: { roles?: string[] } | null };

const session = vi.hoisted(() => ({
  current: { isReady: false, isAuthenticated: false, user: null } as Session,
}));

vi.mock('@/app/(auth)/auth/hooks/use-auth-session', () => ({
  useAuthSession: () => session.current,
}));

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useWorkspaceAdminGate> | null = null;

function Probe() {
  const gate = useWorkspaceAdminGate();
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = gate;
  });
  return null;
}

function renderWith(next: Session) {
  session.current = next;
  act(() => {
    root.render(<Probe />);
  });
}

const signedIn = (roles?: string[]): Session => ({ isReady: true, isAuthenticated: true, user: { roles } });

describe('useWorkspaceAdminGate', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    latest = null;
  });

  it('is loading until the session has answered', () => {
    renderWith({ isReady: false, isAuthenticated: false, user: null });
    expect(latest).toBe('loading');
  });

  it('is loading, not denied, when signed out', () => {
    renderWith({ isReady: true, isAuthenticated: false, user: null });
    expect(latest).toBe('loading');
  });

  it('allows an owner', () => {
    renderWith(signedIn(['OWNER']));
    expect(latest).toBe('allowed');
  });

  it('allows an admin', () => {
    renderWith(signedIn(['ADMIN']));
    expect(latest).toBe('allowed');
  });

  it('compares roles case-insensitively', () => {
    renderWith(signedIn(['admin']));
    expect(latest).toBe('allowed');
  });

  it('denies every other role', () => {
    renderWith(signedIn(['MEMBER']));
    expect(latest).toBe('denied');
  });

  it('denies a user with no roles', () => {
    renderWith(signedIn(undefined));
    expect(latest).toBe('denied');
  });
});
