// Pins the dev/QA onboarding shortcuts' wiring: a skip writes BOTH returned
// records into the onboarding store (the wizard redirect and the tour read
// them there), a tenant reset writes the tenant one, and a call that fails -
// e.g. the field missing from the schema where the flag was flipped without
// the backend switch - toasts the GraphQL message, not relay's wrapper, and
// does not hand over to the caller.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingMutations } from './use-onboarding-mutations';

type MutationConfig = {
  onCompleted: (response: unknown) => void;
  onError: (error: Error) => void;
};

const { commitMutation, toast } = vi.hoisted(() => ({
  commitMutation: vi.fn<(environment: unknown, config: MutationConfig) => void>(),
  toast: vi.fn<(options: Record<string, unknown>) => void>(),
}));

vi.mock('react-relay', () => ({ graphql: () => ({}), commitMutation, useRelayEnvironment: () => ({}) }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

const SKIPPED = {
  skipOnboarding: {
    tenant: {
      completedSteps: ['MSP_SETUP', 'CUSTOMERS_SETUP', 'DEVICE_MANAGEMENT', 'MEET_MINGO'],
      completed: true,
      completedAt: '2026-10-23T12:00:00Z',
    },
    user: {
      completedSteps: [],
      completed: false,
      completedAt: null,
      skipped: true,
      skippedAt: '2026-10-23T12:00:00Z',
      tourDialogId: null,
    },
  },
};

const UNDEFINED_FIELD =
  "Validation error (FieldUndefined@[skipOnboarding]) : Field 'skipOnboarding' in type 'Mutation' is undefined";

let container: HTMLDivElement;
let root: Root;
let mutations: ReturnType<typeof useOnboardingMutations>;

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useOnboardingMutations>) => void }) {
  const api = useOnboardingMutations();
  useEffect(() => onReady(api));
  return null;
}

function lastConfig(): MutationConfig {
  const config = commitMutation.mock.lastCall?.[1];
  if (!config) throw new Error('no mutation committed');
  return config;
}

beforeEach(() => {
  useOnboardingStore.getState().reset();
  commitMutation.mockReset();
  toast.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <Probe
        onReady={api => {
          mutations = api;
        }}
      />,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useOnboardingMutations - dev shortcuts', () => {
  it('skipOnboarding writes the tenant and the user record, then hands over', () => {
    const onDone = vi.fn();
    act(() => mutations.skipOnboarding(onDone));
    act(() => lastConfig().onCompleted(SKIPPED));

    const { tenant, user } = useOnboardingStore.getState();
    expect(tenant?.completed).toBe(true);
    expect(tenant?.completedSteps).toHaveLength(4);
    expect(user?.skipped).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mutations.isMutating).toBe(false);
  });

  it('skipOnboarding toasts the GraphQL message on failure and does not hand over', () => {
    const onDone = vi.fn();
    act(() => mutations.skipOnboarding(onDone));
    const error = Object.assign(
      new Error(
        `No data returned for operation \`skipOnboardingMutation\`, got error(s):\n${UNDEFINED_FIELD}\n\nSee the error \`source\` property for more information.`,
      ),
      { source: { errors: [{ message: UNDEFINED_FIELD }] } },
    );
    act(() => lastConfig().onError(error));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: UNDEFINED_FIELD, variant: 'destructive' }),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().tenant).toBeNull();
    expect(mutations.isMutating).toBe(false);
  });

  it('resetTenant writes the clean tenant record and confirms', () => {
    useOnboardingStore.getState().setTenant(SKIPPED.skipOnboarding.tenant as never);
    const onDone = vi.fn();
    act(() => mutations.resetTenant(onDone));
    act(() =>
      lastConfig().onCompleted({ resetTenantOnboarding: { completedSteps: [], completed: false, completedAt: null } }),
    );

    expect(useOnboardingStore.getState().tenant).toEqual({ completedSteps: [], completed: false, completedAt: null });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
