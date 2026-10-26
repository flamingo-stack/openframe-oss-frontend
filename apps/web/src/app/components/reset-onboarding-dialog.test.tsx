// Pins what confirming "Reset Onboarding" does: once the reset lands the dialog
// closes and the host is told (the Mingo menu takes the user to the setup
// wizard from there); a reset that does not land goes nowhere.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetOnboardingDialog } from './reset-onboarding-dialog';

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
