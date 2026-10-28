// Pins the wizard's "Skip onboarding (dev)": it shows only once the
// `onboarding-skip` flag has answered "on" and the progress is read (stage and
// prod have no flag, and no mutation behind it), and it leaves for the
// dashboard only once the skip has landed.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { DevSkipOnboardingButton } from './dev-skip-onboarding-button';

const { replace, skipOnboarding } = vi.hoisted(() => ({ replace: vi.fn(), skipOnboarding: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('@/graphql/onboarding/use-onboarding-mutations', () => ({
  useOnboardingMutations: () => ({ skipOnboarding, isMutating: false }),
}));

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<DevSkipOnboardingButton />));
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

function withProgress() {
  useOnboardingStore.getState().setTenant({ completedSteps: [], completed: false, completedAt: null });
}

beforeEach(() => {
  useFeatureFlagsStore.getState().reset();
  useOnboardingStore.getState().reset();
  replace.mockReset();
  skipOnboarding.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('DevSkipOnboardingButton', () => {
  it('is absent while the flag has not answered', () => {
    withProgress();
    render();
    expect(buttons()).toHaveLength(0);
  });

  it('is absent where the flag is off', () => {
    withProgress();
    useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-skip', enabled: false }]);
    render();
    expect(buttons()).toHaveLength(0);
  });

  it('is absent while the progress has not been read', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-skip', enabled: true }]);
    render();
    expect(buttons()).toHaveLength(0);
  });

  it('is labelled as a dev action where the flag is on', () => {
    withProgress();
    useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-skip', enabled: true }]);
    render();
    expect(buttons().some(button => button.textContent?.includes('Skip onboarding (dev)'))).toBe(true);
    expect(buttons().some(button => button.getAttribute('aria-label') === 'Skip onboarding (dev)')).toBe(true);
  });

  it('leaves for the dashboard once the skip lands', () => {
    withProgress();
    useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-skip', enabled: true }]);
    skipOnboarding.mockImplementation((onDone: () => void) => onDone());
    render();
    act(() => buttons()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(skipOnboarding).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(routes.dashboard);
  });

  it('stays on the wizard while the skip has not landed', () => {
    withProgress();
    useFeatureFlagsStore.getState().setFlags([{ name: 'onboarding-skip', enabled: true }]);
    render();
    act(() => buttons()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(skipOnboarding).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
