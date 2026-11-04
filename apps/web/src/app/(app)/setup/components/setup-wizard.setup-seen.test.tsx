// Pins what the wizard tells the server about its last screen: "Everything is
// set up" and "You are ready to go" are recorded as seen the moment they show,
// once, and never again for an admin the server has already seen there - and
// that leaving the wizard stays the wizard's own job.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { TenantOnboardingStep } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import {
  type TenantOnboardingProgress,
  useOnboardingStore,
  type UserOnboardingProgress,
} from '@/stores/onboarding-store';
import { SetupWizard } from './setup-wizard';

const { replace, completeTenantStep, completeTenantInBackground, markSetupSeenInBackground, mode } = vi.hoisted(() => ({
  replace: vi.fn(),
  completeTenantStep: vi.fn(),
  completeTenantInBackground: vi.fn(),
  markSetupSeenInBackground: vi.fn(),
  mode: { saas: false },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => mode.saas,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components', async importOriginal => ({
  ...(await importOriginal<object>()),
  LoadingSuspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  LoadingWhen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLoadingScope: () => false,
}));
vi.mock('@/app/(app)/onboarding/hooks/use-tenant-onboarding-auto-detect', () => ({
  useTenantOnboardingAutoDetect: () => new Set(),
}));
vi.mock('@/graphql/onboarding/use-onboarding-mutations', () => ({
  useOnboardingMutations: () => ({ completeTenantStep, completeTenantInBackground, markSetupSeenInBackground }),
}));
vi.mock('../lib/tour-state', () => ({ markTourStarted: vi.fn() }));
vi.mock('./setup-frame', () => ({
  SetupFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../steps/welcome-step', () => ({
  WelcomeStep: ({ onContinue }: { onContinue: () => void }) => (
    <button type="button" onClick={onContinue}>
      Continue
    </button>
  ),
}));
vi.mock('../steps/organization-step', () => ({ OrganizationStep: () => <div>Set Up Your Organization</div> }));
vi.mock('../steps/customer-step', () => ({ CustomerStep: () => <div>Your First Customer</div> }));
vi.mock('../steps/deploy-device-step', () => ({ DeployDeviceStep: () => <div>Deploy First Device</div> }));
vi.mock('../steps/ready-step', () => ({
  ReadyStep: ({ onStart }: { onStart: () => void }) => (
    <button type="button" onClick={onStart}>
      You are ready to go
    </button>
  ),
}));
vi.mock('../steps/all-set-step', () => ({
  AllSetStep: ({ onStart }: { onStart: () => void }) => (
    <button type="button" onClick={onStart}>
      Everything is set up
    </button>
  ),
}));

const FRESH_USER: UserOnboardingProgress = {
  completedSteps: [],
  completed: false,
  completedAt: null,
  skipped: false,
  skippedAt: null,
  tourDialogId: null,
  setupSeen: false,
};

const SET_UP_TENANT: TenantOnboardingProgress = {
  completedSteps: [
    TenantOnboardingStep.MSP_SETUP,
    TenantOnboardingStep.CUSTOMERS_SETUP,
    TenantOnboardingStep.DEVICE_MANAGEMENT,
    TenantOnboardingStep.MEET_MINGO,
  ],
  completed: true,
  completedAt: null,
};

let container: HTMLDivElement;
let root: Root;

function progress(tenant: TenantOnboardingProgress, user: UserOnboardingProgress) {
  const store = useOnboardingStore.getState();
  store.setTenant(tenant);
  store.setUser(user);
}

function render() {
  act(() => root.render(<SetupWizard />));
}

function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === label);
  if (!button) throw new Error(`no button "${label}"`);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

beforeEach(() => {
  replace.mockReset();
  completeTenantStep.mockReset();
  completeTenantInBackground.mockReset();
  markSetupSeenInBackground.mockReset();
  mode.saas = false;
  useOnboardingStore.getState().reset();
  useAuthStore.setState({ user: { id: 'u-1', email: 'ann@example.com' } } as never);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useAuthStore.setState({ user: null } as never);
});

describe('SetupWizard and the last screen', () => {
  it('opens a set-up workspace on "Everything is set up" and records the screen as seen', () => {
    progress(SET_UP_TENANT, FRESH_USER);
    render();

    expect(container.textContent).toContain('Everything is set up');
    expect(markSetupSeenInBackground).toHaveBeenCalledTimes(1);
  });

  it('does not record the screen again for an admin the server has seen there', () => {
    progress(SET_UP_TENANT, { ...FRESH_USER, setupSeen: true });
    render();

    expect(container.textContent).toContain('Everything is set up');
    expect(markSetupSeenInBackground).not.toHaveBeenCalled();
  });

  it('records "You are ready to go" too, and none of the screens before it', () => {
    progress(
      { ...SET_UP_TENANT, completedSteps: SET_UP_TENANT.completedSteps.slice(0, 3), completed: false },
      FRESH_USER,
    );
    render();

    expect(container.textContent).toContain('Continue');
    expect(markSetupSeenInBackground).not.toHaveBeenCalled();

    click('Continue');
    expect(container.textContent).toContain('You are ready to go');
    expect(markSetupSeenInBackground).toHaveBeenCalledTimes(1);
  });

  it('"Start with Mingo" on a set-up workspace leaves for the dashboard by itself', () => {
    progress(SET_UP_TENANT, { ...FRESH_USER, setupSeen: true });
    render();
    click('Everything is set up');

    expect(replace).toHaveBeenCalledWith(routes.dashboard);
  });

  it('"Start with Mingo" on a SaaS tenant leaves for Mingo\'s home, where the tour lives', () => {
    mode.saas = true;
    progress(SET_UP_TENANT, { ...FRESH_USER, setupSeen: true });
    render();
    click('Everything is set up');

    expect(replace).toHaveBeenCalledWith(routes.mingo.home);
  });
});
