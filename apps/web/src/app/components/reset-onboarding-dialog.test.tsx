// Pins what confirming "Reset Onboarding" does: once the reset lands the dialog
// closes and the host is told (the Mingo menu takes the user to the setup
// wizard from there); a reset that does not land goes nowhere. And to whom it
// is offered: anyone with a tour to replay, including an admin who only saw
// the wizard's last screen.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnboardingStore, type UserOnboardingProgress } from '@/stores/onboarding-store';
import { ResetOnboardingDialog, useCanResetOnboarding } from './reset-onboarding-dialog';

const { resetUser } = vi.hoisted(() => ({ resetUser: vi.fn() }));

vi.mock('@/graphql/onboarding/use-onboarding-mutations', () => ({
  useOnboardingMutations: () => ({ resetUser, isMutating: false }),
}));
vi.mock('@/app/components/shared/confirm-dialog', () => ({
  ConfirmDialog: ({ onConfirm }: { onConfirm: () => void }) => (
    <button type="button" onClick={onConfirm}>
      Reset Onboarding
    </button>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetUser.mockReset();
  useOnboardingStore.getState().reset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function confirm(onOpenChange: (open: boolean) => void, onReset: () => void) {
  act(() => root.render(<ResetOnboardingDialog open onOpenChange={onOpenChange} onReset={onReset} />));
  act(() => container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

describe('ResetOnboardingDialog', () => {
  it('closes and hands over to the host once the reset lands', () => {
    resetUser.mockImplementation((onDone: () => void) => onDone());
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

    expect(resetUser).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });
});

const FRESH: UserOnboardingProgress = {
  completedSteps: [],
  completed: false,
  completedAt: null,
  skipped: false,
  skippedAt: null,
  tourDialogId: null,
  setupSeen: false,
};

let offered: boolean | undefined;

function OfferProbe() {
  const canReset = useCanResetOnboarding();
  useEffect(() => {
    offered = canReset;
  });
  return null;
}

/** Whether the reset is offered with this progress (`null`: none read yet). */
function offeredWith(user: Partial<UserOnboardingProgress> | null): boolean | undefined {
  act(() => {
    const store = useOnboardingStore.getState();
    store.reset();
    if (user) store.setUser({ ...FRESH, ...user });
  });
  act(() => root.render(<OfferProbe />));
  return offered;
}

describe('useCanResetOnboarding', () => {
  it('offers nothing before the progress is read, nor to a fresh admin', () => {
    expect(offeredWith(null)).toBe(false);
    expect(offeredWith({})).toBe(false);
  });

  it("offers the replay to an admin who saw the wizard's last screen without starting the tour", () => {
    expect(offeredWith({ setupSeen: true })).toBe(true);
  });

  it('offers it for a tour started, finished or skipped', () => {
    expect(offeredWith({ tourDialogId: 'd-1' })).toBe(true);
    expect(offeredWith({ completed: true })).toBe(true);
    expect(offeredWith({ skipped: true })).toBe(true);
  });
});
