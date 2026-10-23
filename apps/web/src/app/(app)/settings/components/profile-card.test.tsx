// Pins where "Reset Onboarding" lives: the profile menu offers it on an OSS tenant
// (a SaaS tenant's tour resets from the Mingo chat), and only when there is a
// finished or started tour to replay.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ProfileCard } from './profile-card';

const { USER, mode } = vi.hoisted(() => ({
  USER: { id: 'u-1', email: 'a@b.c', firstName: 'Ann', lastName: 'Lee' },
  mode: { saas: false },
}));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => mode.saas,
}));
vi.mock('@/app/(auth)/auth/stores', () => ({
  useAuthStore: (selector: (state: { user: typeof USER }) => unknown) => selector({ user: USER }),
}));

// The menu's popper measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock('@/app/(auth)/auth/hooks/use-auth-session', () => ({
  useAuthSession: () => ({ isReady: true, isAuthenticated: true, user: null }),
}));
vi.mock('@/graphql/onboarding/use-onboarding-mutations', () => ({
  useOnboardingMutations: () => ({ resetUser: vi.fn(), isMutating: false }),
}));
vi.mock('./delete-account-modal', () => ({ DeleteAccountModal: () => null }));
vi.mock('./notification-settings-modal', () => ({ NotificationSettingsModal: () => null }));

let container: HTMLDivElement;
let root: Root;

function menuLabels(): string[] {
  const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Profile actions"]');
  if (!trigger) throw new Error('no profile menu');
  act(() => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  });
  return Array.from(document.querySelectorAll('[role="menuitem"]')).map(item => item.textContent ?? '');
}

function renderCard() {
  act(() => {
    root.render(<ProfileCard onEditProfile={vi.fn()} onVerifyEmail={vi.fn()} />);
  });
}

const FINISHED_TOUR = {
  completedSteps: [],
  completed: true,
  completedAt: null,
  skipped: false,
  skippedAt: null,
  tourDialogId: null,
};

describe('ProfileCard - Reset Onboarding', () => {
  beforeEach(() => {
    mode.saas = false;
    useOnboardingStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('is offered for a finished tour on an OSS tenant', () => {
    useOnboardingStore.getState().setUser(FINISHED_TOUR);
    renderCard();

    expect(menuLabels()).toContain('Reset Onboarding');
  });

  it('is offered for a tour in progress, so an archived tour can start over', () => {
    useOnboardingStore.getState().setUser({ ...FINISHED_TOUR, completed: false, tourDialogId: 'd-tour' });
    renderCard();

    expect(menuLabels()).toContain('Reset Onboarding');
  });

  it('is not offered on a SaaS tenant, whose tour resets from the Mingo chat', () => {
    mode.saas = true;
    useOnboardingStore.getState().setUser(FINISHED_TOUR);
    renderCard();

    const labels = menuLabels();
    expect(labels).toContain('Edit Profile');
    expect(labels).not.toContain('Reset Onboarding');
  });

  it('is not offered before the tour has started', () => {
    useOnboardingStore.getState().setUser({ ...FINISHED_TOUR, completed: false });
    renderCard();

    expect(menuLabels()).not.toContain('Reset Onboarding');
  });
});
