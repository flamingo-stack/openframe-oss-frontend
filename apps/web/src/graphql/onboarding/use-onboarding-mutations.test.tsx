/**
 * The user onboarding mutations keep the Getting Started block's remembered
 * shape in step with the tour: "Reset Onboarding" starts it over as the list,
 * "Finish tour" and skipping the onboarding remove it.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import {
  type useOnboardingMutations as UseOnboardingMutations,
  useOnboardingMutations,
} from './use-onboarding-mutations';

const PROGRESS = {
  completedSteps: [],
  completed: false,
  completedAt: null,
  skipped: false,
  skippedAt: null,
  tourDialogId: null,
  setupSeen: false,
};

vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useRelayEnvironment: () => ({}),
  // Every mutation answers at once with the same progress, under its own field.
  commitMutation: (_env: unknown, config: { onCompleted: (response: unknown) => void }) => {
    config.onCompleted(new Proxy({}, { get: (_target, field) => (typeof field === 'string' ? PROGRESS : undefined) }));
    return { dispose: () => {} };
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));

const USER = 'u-1';
const KEY = `openframe:getting-started-view:${USER}`;

let store: Map<string, string>;
let container: HTMLDivElement;
let root: Root;
let api: ReturnType<typeof UseOnboardingMutations>;

function Probe({ onReady }: { onReady: (mutations: ReturnType<typeof UseOnboardingMutations>) => void }) {
  const mutations = useOnboardingMutations();
  useEffect(() => onReady(mutations));
  return null;
}

beforeEach(() => {
  store = new Map();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  } as Storage;
  vi.stubGlobal('localStorage', storage);
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  useAuthStore.setState({ user: { id: USER, email: 'ann@example.com' } } as never);
  container = document.createElement('div');
  root = createRoot(container);
  act(() =>
    root.render(
      <Probe
        onReady={mutations => {
          api = mutations;
        }}
      />,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  useAuthStore.setState({ user: null } as never);
  useOnboardingStore.getState().reset();
  vi.unstubAllGlobals();
});

describe('useOnboardingMutations and the Getting Started view', () => {
  it('a reset starts the tour over as the list', () => {
    store.set(KEY, 'collapsed');
    act(() => api.resetUser());
    expect(store.get(KEY)).toBe('default');
  });

  it('finishing the tour removes the remembered view', () => {
    store.set(KEY, 'collapsed');
    act(() => api.completeUserInBackground());
    expect(store.has(KEY)).toBe(false);
  });

  it('skipping the onboarding removes it too', () => {
    store.set(KEY, 'default');
    act(() => api.skipUser());
    expect(store.has(KEY)).toBe(false);
  });
});

describe('useOnboardingMutations and the setup wizard', () => {
  it('marking the last screen as seen mirrors the answer into the store', () => {
    PROGRESS.setupSeen = true;
    try {
      act(() => api.markSetupSeenInBackground());
      expect(useOnboardingStore.getState().user?.setupSeen).toBe(true);
    } finally {
      PROGRESS.setupSeen = false;
    }
  });
});
