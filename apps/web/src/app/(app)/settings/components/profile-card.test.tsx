// Pins where "Reset Onboarding" lives: the profile menu offers it only while
// Mingo v2 is off (v2 moves it into the Mingo chat's ⋯ menu), never while the
// flag has not answered yet, and only when there is a finished tour to replay.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ProfileCard } from './profile-card';

const { USER } = vi.hoisted(() => ({ USER: { id: 'u-1', email: 'a@b.c', firstName: 'Ann', lastName: 'Lee' } }));
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

describe('ProfileCard - Reset Onboarding', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
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

  it('is offered for a finished tour while Mingo v2 is off', () => {
    useOnboardingStore.getState().setUser({
      completedSteps: [],
      completed: true,
      completedAt: null,
      skipped: false,
      skippedAt: null,
    });
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-v2', enabled: false }]);
    renderCard();

    expect(menuLabels()).toContain('Reset Onboarding');
  });

  it('moves out with Mingo v2 on', () => {
    useOnboardingStore.getState().setUser({
      completedSteps: [],
      completed: true,
      completedAt: null,
      skipped: false,
      skippedAt: null,
    });
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-v2', enabled: true }]);
    renderCard();

    const labels = menuLabels();
    expect(labels).toContain('Edit Profile');
    expect(labels).not.toContain('Reset Onboarding');
  });

  it('waits for the flags to answer', () => {
    useOnboardingStore.getState().setUser({
      completedSteps: [],
      completed: false,
      completedAt: null,
      skipped: true,
      skippedAt: null,
    });
    renderCard();

    expect(menuLabels()).not.toContain('Reset Onboarding');
  });
});
