// Pins the dev/QA onboarding shortcuts in the Mingo chat's ⋯ menu: nothing
// without the `onboarding-skip` flag; "Skip onboarding (dev)" only while the
// user's Get Started is still open; "Reset Initial Setup (dev)" only once the
// tenant has setup progress to clear; and the reset confirm hands over to the
// host only once the reset has landed.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { type UserOnboardingProgress, useOnboardingStore } from '@/stores/onboarding-store';
import { ResetInitialSetupDialog, useDevOnboardingMenuItems } from './dev-onboarding-shortcuts';

const { skipOnboarding, resetTenant } = vi.hoisted(() => ({ skipOnboarding: vi.fn(), resetTenant: vi.fn() }));

vi.mock('@/graphql/onboarding/use-onboarding-mutations', () => ({
  useOnboardingMutations: () => ({ skipOnboarding, resetTenant, isMutating: false }),
}));
vi.mock('@/app/components/shared/confirm-dialog', () => ({
  ConfirmDialog: ({ onConfirm }: { onConfirm: () => void }) => (
    <button type="button" onClick={onConfirm}>
      Reset Initial Setup
    </button>
  ),
}));

const OPEN_USER: UserOnboardingProgress = {
  completedSteps: [],
  completed: false,
  completedAt: null,
  skipped: false,
  skippedAt: null,
  tourDialogId: 'd-1',
  setupSeen: false,
};

let container: HTMLDivElement;
let root: Root;
let items: ReturnType<typeof useDevOnboardingMenuItems> = [];
const onResetInitialSetup = vi.fn();

function Probe({ onItems }: { onItems: (next: ReturnType<typeof useDevOnboardingMenuItems>) => void }) {
  const next = useDevOnboardingMenuItems(onResetInitialSetup);
  useEffect(() => onItems(next));
  return null;
}

function ids(): string[] {
  act(() =>
    root.render(
      <Probe
        onItems={next => {
          items = next;
        }}
      />,
    ),
  );
  return items.map(item => item.id);
}

function flagOn() {
  useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-skip', enabled: true }]);
}

beforeEach(() => {
  useFeatureFlagsStore.getState().reset();
  useOnboardingStore.getState().reset();
  skipOnboarding.mockReset();
  resetTenant.mockReset();
  onResetInitialSetup.mockReset();
  items = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useDevOnboardingMenuItems', () => {
  it('offers nothing where the flag is off', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-skip', enabled: false }]);
    useOnboardingStore.getState().setUser(OPEN_USER);
    useOnboardingStore.getState().setTenant({ completedSteps: [], completed: true, completedAt: null });
    expect(ids()).toEqual([]);
  });

  it('offers both while the tour is open on a set-up workspace', () => {
    flagOn();
    useOnboardingStore.getState().setUser(OPEN_USER);
    useOnboardingStore.getState().setTenant({ completedSteps: [], completed: true, completedAt: null });
    expect(ids()).toEqual(['dev-skip-onboarding', 'dev-reset-initial-setup']);
  });

  it('drops the skip once the Get Started is skipped or finished', () => {
    flagOn();
    useOnboardingStore.getState().setTenant({ completedSteps: [], completed: true, completedAt: null });
    useOnboardingStore.getState().setUser({ ...OPEN_USER, skipped: true });
    expect(ids()).toEqual(['dev-reset-initial-setup']);
    useOnboardingStore.getState().setUser({ ...OPEN_USER, completed: true });
    expect(ids()).toEqual(['dev-reset-initial-setup']);
  });

  it('offers the reset for a partly set-up workspace, and not for an untouched one', () => {
    flagOn();
    useOnboardingStore.getState().setTenant({ completedSteps: ['MSP_SETUP'], completed: false, completedAt: null });
    expect(ids()).toEqual(['dev-reset-initial-setup']);
    useOnboardingStore.getState().setTenant({ completedSteps: [], completed: false, completedAt: null });
    expect(ids()).toEqual([]);
  });

  it('wires the skip to the mutation and the reset to the host', () => {
    flagOn();
    useOnboardingStore.getState().setUser(OPEN_USER);
    useOnboardingStore.getState().setTenant({ completedSteps: [], completed: true, completedAt: null });
    ids();
    items.find(item => item.id === 'dev-skip-onboarding')?.onClick?.();
    items.find(item => item.id === 'dev-reset-initial-setup')?.onClick?.();

    expect(skipOnboarding).toHaveBeenCalledTimes(1);
    expect(onResetInitialSetup).toHaveBeenCalledTimes(1);
  });
});

describe('ResetInitialSetupDialog', () => {
  function confirm(onOpenChange: (open: boolean) => void, onReset: () => void) {
    act(() => root.render(<ResetInitialSetupDialog open onOpenChange={onOpenChange} onReset={onReset} />));
    act(() => container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  }

  it('closes and hands over to the host once the reset lands', () => {
    resetTenant.mockImplementation((onDone: () => void) => onDone());
    const onOpenChange = vi.fn();
    const onReset = vi.fn();
    confirm(onOpenChange, onReset);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('goes nowhere while the reset has not landed', () => {
    const onOpenChange = vi.fn();
    const onReset = vi.fn();
    confirm(onOpenChange, onReset);

    expect(resetTenant).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });
});
