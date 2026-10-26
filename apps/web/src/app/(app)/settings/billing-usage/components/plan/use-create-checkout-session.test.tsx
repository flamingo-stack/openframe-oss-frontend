/**
 * Checkout failures as the paywall reports them. A tenant that re-subscribes
 * while its cancelled pay-as-you-go subscription is still being closed in
 * Stripe is refused with `PREVIOUS_SUBSCRIPTION_FINALIZING` (CU-17tkuw5zexd);
 * it should be told to come back in a few minutes, not shown a raw error.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CheckoutInput, useCreateCheckoutSession } from './use-create-checkout-session';

const spies = vi.hoisted(() => ({
  commit: vi.fn(),
  toast: vi.fn(),
  tab: { cancel: vi.fn(), navigate: vi.fn() },
}));

// The `graphql` tag needs the Relay transform, which vitest has no equivalent of.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useMutation: () => [spies.commit, false],
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));
vi.mock('../shared/stripe-window', () => ({
  openDeferredTab: () => spies.tab,
}));

/** What relay-runtime throws for a mutation that answered with errors and no data. */
function relayError(message: string, code: string): Error {
  return Object.assign(new Error(`No data returned for operation, got error(s):\n${message}`), {
    source: { errors: [{ message, extensions: { code } }] },
  });
}

let container: HTMLDivElement;
let root: Root;

function Harness() {
  const { mutate } = useCreateCheckoutSession();
  return <button type="button" onClick={() => mutate({} as CheckoutInput)} />;
}

function failCheckoutWith(error: Error) {
  act(() => container.querySelector('button')?.click());
  const { onError } = spies.commit.mock.calls[0][0];
  act(() => onError(error));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('useCreateCheckoutSession — failures', () => {
  it('previous subscription still closing: says so and asks to retry in a few minutes', () => {
    failCheckoutWith(
      relayError(
        'Your previous subscription is still being finalized; try again in a few minutes',
        'PREVIOUS_SUBSCRIPTION_FINALIZING',
      ),
    );

    expect(spies.tab.cancel).toHaveBeenCalledOnce();
    expect(spies.toast).toHaveBeenCalledExactlyOnceWith({
      title: 'Previous subscription is closing',
      description: 'Your previous subscription is still being finalized. Please try again in a few minutes.',
      variant: 'destructive',
    });
  });

  it('any other failure: shows the backend message as before', () => {
    failCheckoutWith(relayError('Billing plan not found: tenant-1', 'BILLING_PLAN_NOT_FOUND'));

    expect(spies.tab.cancel).toHaveBeenCalledOnce();
    expect(spies.toast).toHaveBeenCalledWith({
      title: 'Checkout Failed',
      description: 'Billing plan not found: tenant-1',
      variant: 'destructive',
    });
  });
});
