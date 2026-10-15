// Pins where "Reset Onboarding" lives: the profile menu offers it only while
// the v2 chat look is off (Mingo v2 or the Mingo-first shell move it into the
// Mingo chat's ⋯ menu), never while the flags have not answered yet, and only
// when there is a finished tour to replay. And the "Classic layout" switch: on a
// tenant with the Mingo-first shell only, wired to the per-browser opt-out.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASSIC_LAYOUT_KEY } from '@/lib/shell-variant';
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

const FINISHED_TOUR = {
  completedSteps: [],
  completed: true,
  completedAt: null,
  skipped: false,
  skippedAt: null,
};

describe('ProfileCard - Mingo-first shell', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    useOnboardingStore.getState().reset();
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  const classicSwitch = () => container.querySelector<HTMLButtonElement>('button[role="switch"]');

  it('moves Reset Onboarding out in the Mingo-first shell, whatever mingo-v2 says', () => {
    useOnboardingStore.getState().setUser(FINISHED_TOUR);
    useFeatureFlagsStore.getState().setFlags([
      { name: 'mingo-first', enabled: true },
      { name: 'mingo-v2', enabled: false },
    ]);
    renderCard();

    expect(menuLabels()).not.toContain('Reset Onboarding');
  });

  it('offers no Classic layout switch on a tenant without the shell, or before the flags answer', () => {
    renderCard();
    expect(classicSwitch()).toBeNull();

    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: false }]));
    expect(classicSwitch()).toBeNull();
  });

  it('switches to the classic layout and back, in place', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: true }]);
    renderCard();

    const toggle = classicSwitch();
    if (!toggle) throw new Error('no Classic layout switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    act(() => toggle.click());
    expect(window.localStorage.getItem(CLASSIC_LAYOUT_KEY)).toBe('true');
    expect(classicSwitch()?.getAttribute('aria-checked')).toBe('true');

    act(() => classicSwitch()?.click());
    expect(window.localStorage.getItem(CLASSIC_LAYOUT_KEY)).toBeNull();
    expect(classicSwitch()?.getAttribute('aria-checked')).toBe('false');
  });
});
