// Pins where a session belongs under onboarding v2: the wizard while the
// workspace owes its Initial Setup, then once for an admin the server has not
// yet seen on the wizard's last screen, and the dashboard from there on,
// whatever browser or device they come from.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useOnboardingStore, type UserOnboardingProgress } from '@/stores/onboarding-store';
import { markTourStarted } from '../lib/tour-state';
import { type SetupPending, useSetupPending } from './use-setup-pending';

const USER = 'u-1';

const FRESH: UserOnboardingProgress = {
  completedSteps: [],
  completed: false,
  completedAt: null,
  skipped: false,
  skippedAt: null,
  tourDialogId: null,
  setupSeen: false,
};

let container: HTMLDivElement;
let root: Root;
let answer: SetupPending | undefined;

function Probe() {
  const pending = useSetupPending();
  useEffect(() => {
    answer = pending;
  });
  return null;
}

function read(): SetupPending | undefined {
  act(() => root.render(<Probe />));
  return answer;
}

function flag(enabled: boolean) {
  useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-v2', enabled }]);
}

function progress(tenantCompleted: boolean, user: Partial<UserOnboardingProgress> = {}) {
  const store = useOnboardingStore.getState();
  store.setTenant({ completedSteps: [], completed: tenantCompleted, completedAt: null });
  store.setUser({ ...FRESH, ...user });
}

beforeEach(() => {
  answer = undefined;
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  } as Storage;
  vi.stubGlobal('localStorage', storage);
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  useFeatureFlagsStore.getState().reset();
  useOnboardingStore.getState().reset();
  useAuthStore.setState({ user: { id: USER, email: 'ann@example.com' } } as never);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  useAuthStore.setState({ user: null } as never);
  vi.unstubAllGlobals();
});

describe('useSetupPending', () => {
  it('is unknown until the flag and the progress have both answered', () => {
    expect(read()).toBe('unknown');
    flag(true);
    expect(read()).toBe('unknown');
    useFeatureFlagsStore.getState().reset();
    progress(true);
    expect(read()).toBe('unknown');
  });

  it('is none where the flag is off, and without a progress record', () => {
    flag(false);
    progress(false);
    expect(read()).toBe('none');

    flag(true);
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setLoaded();
    expect(read()).toBe('none');
  });

  it('is the wizard while the workspace owes its Initial Setup, seen or not', () => {
    flag(true);
    progress(false, { setupSeen: true });
    expect(read()).toBe('setup');
  });

  it('is the wizard once for an admin the server has not seen on its last screen', () => {
    flag(true);
    progress(true);
    expect(read()).toBe('setup');
  });

  it('is the dashboard once the server has seen the admin there, on any device', () => {
    flag(true);
    progress(true, { setupSeen: true });
    expect(read()).toBe('none');
  });

  it('is the dashboard for a tour recorded before the server kept the screen', () => {
    flag(true);
    progress(true, { tourDialogId: 'd-1' });
    expect(read()).toBe('none');
  });

  it('is the dashboard for a tour finished or skipped', () => {
    flag(true);
    progress(true, { completed: true });
    expect(read()).toBe('none');
    progress(true, { skipped: true });
    expect(read()).toBe('none');
  });

  it('is the dashboard right after "Start with Mingo" on this device', () => {
    flag(true);
    progress(true);
    act(() => markTourStarted(USER));
    expect(read()).toBe('none');
  });
});
