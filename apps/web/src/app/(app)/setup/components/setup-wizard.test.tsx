/**
 * The wizard while its data is read draws the screen it is about to show, never another one: a workspace
 * already set up (an admin after the first, a tour reset) waits on "Everything is set up", one still to set
 * up on the welcome screen, and before the progress answers neither.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnboardingStore } from '@/stores/onboarding-store';

const detect = vi.hoisted(() => ({ pending: true }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
// The data auto-detect is the wizard's one suspending read: pending, it holds the wizard on its boundary.
vi.mock('@/app/(app)/onboarding/hooks/use-tenant-onboarding-auto-detect', () => ({
  useTenantOnboardingAutoDetect: () => {
    if (detect.pending) throw new Promise(() => {});
    return new Set();
  },
}));
vi.mock('@/graphql/onboarding/use-onboarding-mutations', () => ({
  useOnboardingMutations: () => ({ completeTenantStep: vi.fn(), completeTenantInBackground: vi.fn() }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useDownloads: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('./setup-frame', () => ({
  SetupFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// The walk's screens, past the two this is about.
vi.mock('../steps/organization-step', () => ({ OrganizationStep: () => null }));
vi.mock('../steps/customer-step', () => ({ CustomerStep: () => null }));
vi.mock('../steps/deploy-device-step', () => ({ DeployDeviceStep: () => null }));
vi.mock('../steps/ready-step', () => ({ ReadyStep: () => null }));

import { SetupWizard } from './setup-wizard';

// The lib `Tag` ("Everything is set up"'s areas) measures its label for the truncation tooltip; jsdom has no
// `ResizeObserver`, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const WELCOME = 'Agentic AI that runs your IT';
const ALL_SET = 'Everything is set up';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  detect.pending = true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useOnboardingStore.getState().reset();
});

const tenant = (completed: boolean) => ({ completedSteps: [], completed, completedAt: null });
const render = () => act(() => root.render(<SetupWizard />));
const title = () => container.querySelector('h1')?.textContent ?? null;

describe('SetupWizard while its data is read', () => {
  it('waits on "Everything is set up" for a workspace already set up, as after a tour reset', () => {
    useOnboardingStore.getState().setTenant(tenant(true));
    render();
    expect(title()).toBe(ALL_SET);
    expect(container.textContent).not.toContain(WELCOME);
  });

  it('waits on the welcome screen for a workspace still to set up', () => {
    useOnboardingStore.getState().setTenant(tenant(false));
    render();
    expect(title()).toBe(WELCOME);
  });

  it('draws no screen before the progress answers', () => {
    render();
    expect(title()).toBeNull();
  });

  it('opens on the screen it waited on once the data lands', () => {
    useOnboardingStore.getState().setTenant(tenant(true));
    detect.pending = false;
    render();
    expect(title()).toBe(ALL_SET);
  });
});
